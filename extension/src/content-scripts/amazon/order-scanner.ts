import { AMAZON_SELECTORS } from "@/constants/selectors";
import { parseAmazonDate, isWithinBenefitYear, getBenefitYear } from "@/lib/benefit-year";
import { logger } from "@/lib/logger";
import { filterEligibleItems } from "./eligibility-filter";
import type { AmazonOrder, OrderItem, BenefitYear } from "@/types";

/**
 * Tries multiple selectors and returns the first matching element.
 */
function querySelector(
  root: Element | Document,
  selectors: readonly string[] | string
): Element | null {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  for (const sel of list) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

/**
 * Extracts the text content of an element, trimmed.
 */
function getText(
  root: Element | Document,
  selectors: readonly string[] | string
): string {
  return querySelector(root, selectors)?.textContent?.trim() ?? "";
}

/**
 * Parses a price string like "$18.99" or "18.99" to cents.
 */
export function parsePriceToCents(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9.]/g, "");
  const dollars = parseFloat(cleaned);
  if (isNaN(dollars)) return 0;
  return Math.round(dollars * 100);
}

/**
 * Extracts order items from a single order container element.
 */
function extractOrderItems(orderEl: Element): OrderItem[] {
  const items: OrderItem[] = [];
  const itemEls = orderEl.querySelectorAll(AMAZON_SELECTORS.orderHistory.orderItem);

  itemEls.forEach((itemEl, index) => {
    const title = getText(itemEl, AMAZON_SELECTORS.orderHistory.itemTitle);
    if (!title) return;

    const priceText = getText(itemEl, AMAZON_SELECTORS.orderHistory.itemPrice);
    const price = parsePriceToCents(priceText);

    items.push({
      id: `item-${index}`,
      title,
      quantity: 1,
      unitPrice: price,
      totalPrice: price,
      isEligible: false, // Will be set by eligibility-filter
    });
  });

  return items;
}

/**
 * Parses a single order card element into an AmazonOrder.
 */
function parseOrderElement(
  orderEl: Element,
  benefitYear: BenefitYear
): AmazonOrder | null {
  // Extract order ID
  let orderId = "";
  for (const sel of AMAZON_SELECTORS.orderHistory.orderId) {
    const el = orderEl.querySelector(sel);
    if (el?.textContent?.trim()) {
      orderId = el.textContent.trim();
      break;
    }
  }
  // Try data attribute fallback
  if (!orderId) {
    orderId = orderEl.getAttribute("data-order-id") ?? "";
  }
  if (!orderId) {
    logger.warn("Could not extract order ID from element:", orderEl);
    return null;
  }

  // Extract order date
  const dateText = getText(orderEl, AMAZON_SELECTORS.orderHistory.orderDate);
  const orderDate = parseAmazonDate(dateText);
  if (!orderDate) {
    logger.warn("Could not parse order date:", dateText);
    return null;
  }

  // Filter by benefit year
  if (!isWithinBenefitYear(orderDate, benefitYear)) {
    return null;
  }

  // Extract total amount
  const totalText = getText(orderEl, AMAZON_SELECTORS.orderHistory.orderTotal);
  const totalAmount = parsePriceToCents(totalText);

  // Extract order details link
  const detailsLink = querySelector(
    orderEl,
    AMAZON_SELECTORS.orderHistory.orderDetailsLink
  );
  const orderDetailUrl = detailsLink
    ? `https://www.amazon.com${detailsLink.getAttribute("href") ?? ""}`
    : "";

  // Extract and filter items
  const rawItems = extractOrderItems(orderEl);
  const { allItems, eligibleItems } = filterEligibleItems(rawItems);

  // Only return orders with at least one eligible item
  if (eligibleItems.length === 0) return null;

  return {
    orderId,
    orderDate,
    totalAmount,
    items: allItems,
    eligibleItems,
    invoiceStatus: "pending",
    orderDetailUrl,
  };
}

/**
 * Scans the current Amazon order history page.
 * Returns found orders and whether there's a next page.
 */
export function scanCurrentPage(benefitYear?: BenefitYear): {
  orders: AmazonOrder[];
  hasNextPage: boolean;
} {
  const year = benefitYear ?? getBenefitYear();
  const orderEls = document.querySelectorAll(
    AMAZON_SELECTORS.orderHistory.orderContainer
  );

  logger.log(`Found ${orderEls.length} order elements on page`);

  const orders: AmazonOrder[] = [];
  orderEls.forEach((el) => {
    const order = parseOrderElement(el, year);
    if (order) orders.push(order);
  });

  const nextPageEl = document.querySelector(
    AMAZON_SELECTORS.orderHistory.paginationNext
  );

  logger.log(
    `Parsed ${orders.length} eligible orders, hasNextPage: ${!!nextPageEl}`
  );

  return { orders, hasNextPage: !!nextPageEl };
}

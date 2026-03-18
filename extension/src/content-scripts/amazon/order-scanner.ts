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
 * Parses a price string like "$18.99" or "18.99" to cents.
 */
export function parsePriceToCents(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9.]/g, "");
  const dollars = parseFloat(cleaned);
  if (isNaN(dollars)) return 0;
  return Math.round(dollars * 100);
}

/**
 * Extracts order metadata (date, total) by finding the label span first,
 * then reading the value from the adjacent .aok-break-word span.
 *
 * Amazon's order cards use a pattern like:
 *   <span class="a-color-secondary a-text-caps">Order placed</span>
 *   <span class="aok-break-word">March 16, 2026</span>
 *
 * Date and total share the same value class, distinguished by their label.
 */
function getMetaByLabel(
  orderEl: Element,
  labelText: string
): string {
  const labelEls = orderEl.querySelectorAll(AMAZON_SELECTORS.orderHistory.metaLabel);
  for (const label of labelEls) {
    if (label.textContent?.trim().toLowerCase() === labelText.toLowerCase()) {
      // Value is typically the next .aok-break-word in the same parent container
      const parent = label.closest(".a-column, .a-col-left, .a-col-right, div") ?? label.parentElement;
      const value = parent?.querySelector(AMAZON_SELECTORS.orderHistory.metaValue);
      if (value?.textContent?.trim()) {
        return value.textContent.trim();
      }
      // Fallback: next element sibling
      let next = label.nextElementSibling;
      while (next) {
        if (next.textContent?.trim()) return next.textContent.trim();
        next = next.nextElementSibling;
      }
    }
  }
  return "";
}

/**
 * Extracts order items from a single order container element.
 */
function extractOrderItems(orderEl: Element): OrderItem[] {
  const items: OrderItem[] = [];
  const itemEls = orderEl.querySelectorAll(AMAZON_SELECTORS.orderHistory.orderItem);

  itemEls.forEach((itemEl, index) => {
    const titleEl = querySelector(itemEl, AMAZON_SELECTORS.orderHistory.itemTitle);
    const title = titleEl?.textContent?.trim() ?? "";
    if (!title) return;

    const priceText = querySelector(itemEl, AMAZON_SELECTORS.orderHistory.itemPrice)?.textContent?.trim() ?? "";
    const price = parsePriceToCents(priceText);

    items.push({
      id: `item-${index}`,
      title,
      quantity: 1,
      unitPrice: price,
      totalPrice: price,
      isEligible: false,
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
  if (!orderId) {
    orderId = orderEl.getAttribute("data-order-id") ?? "";
  }
  if (!orderId) {
    logger.warn("Could not extract order ID from element:", orderEl);
    return null;
  }

  // Extract order date via label lookup
  const dateText = getMetaByLabel(orderEl, "Order placed");
  const orderDate = parseAmazonDate(dateText);
  if (!orderDate) {
    logger.warn("Could not parse order date:", dateText, "for order:", orderId);
    return null;
  }

  // Filter by benefit year
  if (!isWithinBenefitYear(orderDate, benefitYear)) {
    return null;
  }

  // Extract total via label lookup
  const totalText = getMetaByLabel(orderEl, "Total");
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

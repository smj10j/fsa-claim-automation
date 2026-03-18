import { AMAZON_SELECTORS } from "@/constants/selectors";
import { parseAmazonDate, isWithinBenefitYear, getBenefitYear } from "@/lib/benefit-year";
import { filterEligibleItems } from "./eligibility-filter";
import type { AmazonOrder, OrderItem, BenefitYear } from "@/types";

// Always-on debug logger for diagnosing production issues
const D = {
  log: (...a: unknown[]) => console.log("[FSA:scanner]", ...a),
  warn: (...a: unknown[]) => console.warn("[FSA:scanner]", ...a),
  group: (l: string) => console.group("[FSA:scanner] " + l),
  groupEnd: () => console.groupEnd(),
};

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

export function parsePriceToCents(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9.]/g, "");
  const dollars = parseFloat(cleaned);
  if (isNaN(dollars)) return 0;
  return Math.round(dollars * 100);
}

/**
 * Finds a meta value (date, total) by matching label index to value index.
 *
 * Amazon's order card structure has labels and values as parallel lists:
 *   labels[0] = "Order placed"  → values[0] = "December 26, 2025"
 *   labels[1] = "Total"         → values[1] = "$30.28"
 *
 * The label and value are in separate sibling divs, so DOM traversal from
 * the label to its value doesn't work — index-based pairing does.
 */
function getMetaByLabel(orderEl: Element, labelText: string): string {
  const labels = Array.from(orderEl.querySelectorAll(AMAZON_SELECTORS.orderHistory.metaLabel));
  const values = Array.from(orderEl.querySelectorAll(AMAZON_SELECTORS.orderHistory.metaValue));

  for (let i = 0; i < labels.length; i++) {
    if (labels[i]?.textContent?.trim().toLowerCase() === labelText.toLowerCase()) {
      const val = values[i]?.textContent?.trim() ?? "";
      D.log(`getMetaByLabel("${labelText}") → "${val}" (index ${i})`);
      return val;
    }
  }
  D.warn(`getMetaByLabel("${labelText}") → NOT FOUND. Labels found:`, labels.map(l => l.textContent?.trim()));
  return "";
}

function extractOrderItems(orderEl: Element): OrderItem[] {
  const items: OrderItem[] = [];
  const itemEls = orderEl.querySelectorAll(AMAZON_SELECTORS.orderHistory.orderItem);

  itemEls.forEach((itemEl, index) => {
    const titleEl = querySelector(itemEl, AMAZON_SELECTORS.orderHistory.itemTitle);
    const title = titleEl?.textContent?.trim() ?? "";
    if (!title) return;
    const priceText = querySelector(itemEl, AMAZON_SELECTORS.orderHistory.itemPrice)?.textContent?.trim() ?? "";
    const price = parsePriceToCents(priceText);
    items.push({ id: `item-${index}`, title, quantity: 1, unitPrice: price, totalPrice: price, isEligible: false });
  });

  return items;
}

function parseOrderElement(orderEl: Element, benefitYear: BenefitYear): AmazonOrder | null {
  // --- Order ID ---
  let orderId = "";
  for (const sel of AMAZON_SELECTORS.orderHistory.orderId) {
    const el = orderEl.querySelector(sel);
    if (el?.textContent?.trim()) { orderId = el.textContent.trim(); break; }
  }
  if (!orderId) orderId = orderEl.getAttribute("data-order-id") ?? "";
  if (!orderId) {
    D.warn("SKIP: no order ID found. First 200 chars of element:", orderEl.textContent?.substring(0, 200));
    return null;
  }

  // --- Date ---
  const dateText = getMetaByLabel(orderEl, "Order placed");
  D.log(`[${orderId}] raw date text: "${dateText}"`);
  const orderDate = parseAmazonDate(dateText);
  if (!orderDate) {
    D.warn(`[${orderId}] SKIP: could not parse date from "${dateText}"`);
    return null;
  }

  // --- Benefit year filter ---
  const inRange = isWithinBenefitYear(orderDate, benefitYear);
  D.log(`[${orderId}] date: ${orderDate.toISOString()}, benefitYear: ${benefitYear.year}, inRange: ${inRange}`);
  if (!inRange) return null;

  // --- Items ---
  const rawItems = extractOrderItems(orderEl);
  D.log(`[${orderId}] found ${rawItems.length} items:`, rawItems.map(i => i.title));

  const { allItems, eligibleItems } = filterEligibleItems(rawItems);
  D.log(`[${orderId}] eligible items (${eligibleItems.length}):`, eligibleItems.map(i => `${i.title} [${i.eligibilityReason}]`));

  if (eligibleItems.length === 0) {
    D.log(`[${orderId}] SKIP: no eligible items`);
    return null;
  }

  const totalText = getMetaByLabel(orderEl, "Total");
  const totalAmount = parsePriceToCents(totalText);
  const detailsLink = querySelector(orderEl, AMAZON_SELECTORS.orderHistory.orderDetailsLink);
  const orderDetailUrl = detailsLink ? `https://www.amazon.com${detailsLink.getAttribute("href") ?? ""}` : "";

  return { orderId, orderDate, totalAmount, items: allItems, eligibleItems, invoiceStatus: "pending", orderDetailUrl };
}

export function scanCurrentPage(benefitYear?: BenefitYear): { orders: AmazonOrder[]; hasNextPage: boolean } {
  const year = benefitYear ?? getBenefitYear();
  D.log(`scanCurrentPage() — url: ${window.location.href}`);
  D.log(`Benefit year: ${year.year} (${year.start.toISOString()} → ${year.end.toISOString()})`);

  const orderEls = document.querySelectorAll(AMAZON_SELECTORS.orderHistory.orderContainer);
  D.log(`Order container selector "${AMAZON_SELECTORS.orderHistory.orderContainer}" matched ${orderEls.length} elements`);

  if (orderEls.length === 0) {
    D.warn("No order elements found! The page may have a different structure. Body excerpt:", document.body.innerHTML.substring(0, 500));
  }

  const orders: AmazonOrder[] = [];
  D.group(`Parsing ${orderEls.length} order elements`);
  orderEls.forEach((el, i) => {
    D.log(`--- Element ${i} ---`);
    const order = parseOrderElement(el, year);
    if (order) orders.push(order);
  });
  D.groupEnd();

  const nextPageEl = document.querySelector(AMAZON_SELECTORS.orderHistory.paginationNext);

  // ── Per-page summary ─────────────────────────────────────────────────────
  D.log(`━━━ PAGE SUMMARY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  D.log(`  Orders on page:   ${orderEls.length}`);
  D.log(`  FSA eligible:     ${orders.length}`);
  D.log(`  Has next page:    ${!!nextPageEl}`);
  if (orders.length > 0) {
    D.log(`  ── Eligible orders ──`);
    for (const order of orders) {
      const date = order.orderDate instanceof Date
        ? order.orderDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : String(order.orderDate);
      const total = `$${(order.eligibleItems.reduce((s, i) => s + i.totalPrice, 0) / 100).toFixed(2)}`;
      D.log(`  [${date}] ${total} — Order ${order.orderId}`);
      for (const item of order.eligibleItems) {
        D.log(`    • ${item.title} ($${(item.totalPrice / 100).toFixed(2)}) [${item.eligibilityReason ?? "eligible"}]`);
      }
    }
  }
  D.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return { orders, hasNextPage: !!nextPageEl };
}

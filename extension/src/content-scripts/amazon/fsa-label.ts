/**
 * Pure utilities for extracting Amazon's "FSA or HSA eligible: $X.XX" label
 * from the print invoice page.
 *
 * Kept in a separate module so they can be unit-tested without importing the
 * full invoice-capture.ts (which has browser-only top-level side effects).
 */

import { AMAZON_SELECTORS } from "@/constants/selectors";
import { logger } from "@/lib/logger";

/**
 * Searches the document for a text node containing Amazon's FSA label
 * and returns the element that contains it.
 * Amazon has no stable CSS class/ID for this label, so we use a TreeWalker.
 */
function findFsaLabelElement(): Element | null {
  const searchText = AMAZON_SELECTORS.orderDetail.fsaLabelText.toLowerCase();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (node.textContent?.toLowerCase().includes(searchText)) {
      return node.parentElement;
    }
  }
  return null;
}

/** Parses "$34.97" from a string, returns cents, or null if not found. */
export function parseDollarAmountToCents(text: string): number | null {
  const match = /\$\s*([\d,]+\.\d{2})/.exec(text);
  if (!match || !match[1]) return null;
  const dollars = parseFloat(match[1].replace(/,/g, ""));
  if (isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}

/**
 * Extracts the FSA-eligible dollar amount (in cents) from the invoice page.
 *
 * Amazon prints one of these formats near the label:
 *   "FSA or HSA eligible:  $34.97"  — label and price in the same element
 *   "FSA or HSA eligible:"           — label element; price in a sibling/nearby element
 *
 * Returns null if the label is not present on this page.
 */
export function extractFsaEligibleAmount(): number | null {
  const labelEl = findFsaLabelElement();
  if (!labelEl) {
    logger.log("[FSA:invoice] FSA label not found on this page");
    return null;
  }

  logger.log("[FSA:invoice] Found FSA label element:", labelEl.tagName, labelEl.textContent?.trim());

  // Try the label element's own text first (label + price in same element)
  const amountFromLabel = parseDollarAmountToCents(labelEl.textContent ?? "");
  if (amountFromLabel !== null) {
    logger.log("[FSA:invoice] FSA amount from label element:", amountFromLabel);
    return amountFromLabel;
  }

  // Walk up the ancestor chain (up to 5 levels), checking the element's own
  // text and its next sibling at each level. Amazon wraps the label in varying
  // numbers of nested spans/tds, so the price sibling may be 1–3 levels up.
  let ancestor: Element | null = labelEl;
  for (let depth = 0; depth < 5; depth++) {
    // Check the ancestor's own text (catches "label + price in same container")
    if (depth > 0) {
      const amountInAncestor = parseDollarAmountToCents(ancestor.textContent ?? "");
      if (amountInAncestor !== null) {
        logger.log(`[FSA:invoice] FSA amount from ancestor[${depth}] text:`, amountInAncestor);
        return amountInAncestor;
      }
    }

    // Check the ancestor's next element sibling
    const sibling = ancestor.nextElementSibling;
    if (sibling) {
      const amountInSibling = parseDollarAmountToCents(sibling.textContent ?? "");
      if (amountInSibling !== null) {
        logger.log(`[FSA:invoice] FSA amount from ancestor[${depth}] sibling:`, amountInSibling);
        return amountInSibling;
      }
    }

    const parent = ancestor.parentElement;
    if (!parent || parent === document.body) break;
    ancestor = parent;
  }

  logger.warn("[FSA:invoice] FSA label found but amount not parseable. Context:", {
    label: labelEl.textContent,
    labelOuterHTML: labelEl.outerHTML.substring(0, 300),
    parentOuterHTML: labelEl.parentElement?.outerHTML.substring(0, 300),
  });
  return null;
}

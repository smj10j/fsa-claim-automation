import { AMAZON_SELECTORS } from "@/constants/selectors";
import { captureElement } from "@/lib/screenshot";
import { logger } from "@/lib/logger";

/**
 * Captures a screenshot of the order detail/receipt on the current page.
 * Returns a base64 JPEG data URL.
 */
export async function captureOrderReceipt(): Promise<string> {
  // Try to find the receipt container element
  let receiptEl: Element | null = null;

  for (const sel of AMAZON_SELECTORS.orderDetail.receiptContainer) {
    receiptEl = document.querySelector(sel);
    if (receiptEl) {
      logger.log("Found receipt container with selector:", sel);
      break;
    }
  }

  if (!receiptEl) {
    // Fallback: capture the main content area
    receiptEl =
      document.querySelector("#orderDetails") ??
      document.querySelector("main") ??
      document.body;
    logger.warn("Using fallback receipt container:", receiptEl?.tagName);
  }

  const dataUrl = await captureElement(receiptEl as HTMLElement);
  logger.log(
    "Invoice captured, size:",
    Math.round((dataUrl.length * 0.75) / 1024),
    "KB"
  );
  return dataUrl;
}

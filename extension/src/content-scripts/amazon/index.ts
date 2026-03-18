/**
 * Amazon content script entry point.
 * Listens for messages from the service worker and performs scanning/capture.
 */

import type { SWToAmazonMessage } from "@/types";
import { getBenefitYear } from "@/lib/benefit-year";
import { logger } from "@/lib/logger";
import { scanCurrentPage } from "./order-scanner";
import { captureOrderReceipt } from "./invoice-capture";

logger.log("Amazon content script loaded on:", window.location.href);

chrome.runtime.onMessage.addListener(
  (message: SWToAmazonMessage, _sender, sendResponse) => {
    void handleMessage(message).then(sendResponse).catch((err: unknown) => {
      logger.error("Amazon CS error:", err);
      sendResponse({ error: String(err) });
    });
    return true; // async
  }
);

async function handleMessage(message: SWToAmazonMessage): Promise<unknown> {
  switch (message.type) {
    case "SCAN_ORDERS": {
      const benefitYear = getBenefitYear();
      // Override with the dates passed from the service worker
      benefitYear.start = new Date(message.benefitYearStart);
      benefitYear.end = new Date(message.benefitYearEnd);

      const { orders, hasNextPage } = scanCurrentPage(benefitYear);

      await chrome.runtime.sendMessage({
        type: "SCAN_ORDERS_RESULT",
        orders,
        hasNextPage,
      });

      // If there's a next page, click it
      if (hasNextPage) {
        const nextBtn = document.querySelector(
          ".a-pagination .a-last a"
        ) as HTMLAnchorElement | null;
        if (nextBtn?.href) {
          window.location.href = nextBtn.href;
        }
      }

      return { ok: true };
    }

    case "CAPTURE_INVOICE": {
      try {
        const dataUrl = await captureOrderReceipt();
        await chrome.runtime.sendMessage({
          type: "CAPTURE_INVOICE_RESULT",
          orderId: message.orderId,
          dataUrl,
        });
      } catch (err) {
        await chrome.runtime.sendMessage({
          type: "CAPTURE_INVOICE_ERROR",
          orderId: message.orderId,
          message: String(err),
        });
      }
      return { ok: true };
    }

    default:
      return { error: "Unknown message" };
  }
}

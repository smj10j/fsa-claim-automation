import type { AppState } from "@/types";
import { AMAZON_SELECTORS } from "@/constants/selectors";
import { captureElement } from "@/lib/screenshot";
import { logger } from "@/lib/logger";
import { extractFsaEligibleAmount } from "./fsa-label";

// ── Screenshot capture ────────────────────────────────────────────────────────

/**
 * Captures a screenshot of the current page's order receipt.
 * On the print invoice page, this captures document.body (the full invoice).
 * Returns a base64 JPEG data URL.
 */
export async function captureOrderReceipt(): Promise<string> {
  let receiptEl: Element | null = null;
  for (const sel of AMAZON_SELECTORS.orderDetail.receiptContainer) {
    receiptEl = document.querySelector(sel);
    if (receiptEl) {
      logger.log("Found receipt container with selector:", sel);
      break;
    }
  }

  if (!receiptEl) {
    receiptEl = document.querySelector("main") ?? document.body;
    logger.warn("Using fallback receipt container:", receiptEl?.tagName);
  }

  const dataUrl = await captureElement(receiptEl as HTMLElement);
  logger.log("Invoice captured, size:", Math.round((dataUrl.length * 0.75) / 1024), "KB");
  return dataUrl;
}

// ── Auto-run on page load ──────────────────────────────────────────────────────

function extractOrderIdFromUrl(url: string): string | null {
  const match = /[?&]orderID=([\d-]+)/i.exec(url);
  return match?.[1] ?? null;
}

const orderId = extractOrderIdFromUrl(window.location.href);
if (orderId) {
  logger.log("[FSA:invoice] Loaded on invoice page, orderId:", orderId);

  chrome.storage.local.get("appState", (result) => {
    const state = result["appState"] as AppState | undefined;
    logger.log("[FSA:invoice] currentStep:", state?.currentStep);

    if (state?.currentStep === "scanning_invoices") {
      // New flow: extract FSA label + capture screenshot in one visit
      logger.log("[FSA:invoice] scanning_invoices — extracting FSA label for order:", orderId);

      const fsaEligibleAmountCents = extractFsaEligibleAmount();
      logger.log("[FSA:invoice] FSA eligible amount (cents):", fsaEligibleAmountCents);

      // Capture screenshot regardless of whether label was found
      // (we store it only if label was found, but capture anyway for logging)
      void captureOrderReceipt()
        .then((dataUrl) => {
          chrome.runtime.sendMessage({
            type: "INVOICE_SCAN_RESULT",
            orderId,
            fsaEligibleAmountCents,
            dataUrl: fsaEligibleAmountCents !== null ? dataUrl : null,
          });
        })
        .catch((err) => {
          logger.error("[FSA:invoice] Screenshot capture failed:", err);
          // Still report the FSA amount even if screenshot failed
          chrome.runtime.sendMessage({
            type: "INVOICE_SCAN_RESULT",
            orderId,
            fsaEligibleAmountCents,
            dataUrl: null,
          });
        });

    } else if (state?.currentStep === "capturing_invoices") {
      // Legacy flow fallback
      logger.log("[FSA:invoice] capturing_invoices (legacy) — capturing receipt for order:", orderId);
      void captureOrderReceipt()
        .then((dataUrl) =>
          chrome.runtime.sendMessage({ type: "CAPTURE_INVOICE_RESULT", orderId, dataUrl })
        )
        .catch((err) => {
          logger.error("[FSA:invoice] Capture failed:", err);
          void chrome.runtime.sendMessage({
            type: "CAPTURE_INVOICE_ERROR",
            orderId,
            message: String(err),
          });
        });
    }
  });
}

/**
 * Amazon content script entry point.
 *
 * Instead of waiting for a message from the service worker (which has race
 * conditions with content script initialization timing), this script:
 * 1. Checks storage on load — if currentStep is "scanning_amazon", scans immediately
 * 2. Listens to storage changes — reacts if step changes while the page is open
 *
 * This is more reliable than message-based triggering across MV3 SW restarts.
 */

import type { AppState } from "@/types";
import { getBenefitYear } from "@/lib/benefit-year";
import { logger } from "@/lib/logger";
import { scanCurrentPage } from "./order-scanner";
import { captureOrderReceipt } from "./invoice-capture";

logger.log("Amazon content script loaded on:", window.location.href);

let scanInProgress = false;

async function runScan(state: AppState) {
  if (scanInProgress) return;
  scanInProgress = true;

  logger.log("Starting order scan for benefit year:", state.benefitYear.label);

  try {
    const benefitYear = {
      ...state.benefitYear,
      start: new Date(state.benefitYear.start),
      end: new Date(state.benefitYear.end),
    };

    const { orders, hasNextPage } = scanCurrentPage(benefitYear);

    logger.log(`Scan complete: ${orders.length} eligible orders, hasNextPage: ${hasNextPage}`);

    await chrome.runtime.sendMessage({
      type: "SCAN_ORDERS_RESULT",
      orders,
      hasNextPage,
    });

    // Advance to next page if present
    if (hasNextPage) {
      const nextBtn = document.querySelector(
        ".a-pagination .a-last a"
      ) as HTMLAnchorElement | null;
      if (nextBtn?.href) {
        window.location.href = nextBtn.href;
      }
    }
  } catch (err) {
    logger.error("Scan error:", err);
    await chrome.runtime.sendMessage({
      type: "SCAN_ORDERS_ERROR",
      message: String(err),
    });
  } finally {
    scanInProgress = false;
  }
}

async function runCapture(orderId: string) {
  try {
    const dataUrl = await captureOrderReceipt();
    await chrome.runtime.sendMessage({
      type: "CAPTURE_INVOICE_RESULT",
      orderId,
      dataUrl,
    });
  } catch (err) {
    await chrome.runtime.sendMessage({
      type: "CAPTURE_INVOICE_ERROR",
      orderId,
      message: String(err),
    });
  }
}

// ── Check state on load ───────────────────────────────────────────────────────
chrome.storage.local.get("appState", (result) => {
  const state = result["appState"] as AppState | undefined;
  if (!state) return;

  if (state.currentStep === "scanning_amazon") {
    void runScan(state);
  }

  // Handle invoice capture: if we're on an order detail page
  if (state.currentStep === "capturing_invoices") {
    const urlOrderId = extractOrderIdFromUrl(window.location.href);
    if (urlOrderId) {
      void runCapture(urlOrderId);
    }
  }
});

// ── React to storage changes ──────────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes) => {
  const newState = changes["appState"]?.newValue as AppState | undefined;
  if (!newState) return;

  if (newState.currentStep === "scanning_amazon" && !scanInProgress) {
    void runScan(newState);
  }
});

// ── Also accept direct messages as a fallback ─────────────────────────────────
chrome.runtime.onMessage.addListener((message: { type: string; orderId?: string }, _sender, sendResponse) => {
  if (message.type === "CAPTURE_INVOICE" && message.orderId) {
    void runCapture(message.orderId).then(() => sendResponse({ ok: true }));
    return true;
  }
});

function extractOrderIdFromUrl(url: string): string | null {
  const match = /orderID=(\d{3}-\d{7}-\d{7})/.exec(url);
  return match?.[1] ?? null;
}

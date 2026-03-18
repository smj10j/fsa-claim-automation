import type { AppState } from "@/types";
import { getBenefitYear } from "@/lib/benefit-year";
import { scanCurrentPage } from "./order-scanner";
import { captureOrderReceipt } from "./invoice-capture";

const D = {
  log: (...a: unknown[]) => console.log("[FSA:amazon]", ...a),
  error: (...a: unknown[]) => console.error("[FSA:amazon]", ...a),
};

D.log("Content script loaded. URL:", window.location.href);

let scanInProgress = false;

async function runScan(state: AppState) {
  if (scanInProgress) {
    D.log("Scan already in progress, skipping.");
    return;
  }
  scanInProgress = true;
  D.log("runScan() called. benefitYear:", state.benefitYear?.label, "currentStep:", state.currentStep);

  try {
    // Rebuild benefit year from the stored year number — avoids Date serialization issues.
    // chrome.storage.local serializes Date objects to ISO strings which may not round-trip
    // cleanly depending on timezone. The year number is always safe.
    const benefitYear = getBenefitYear(state.benefitYear?.year);
    D.log("Benefit year reconstructed:", benefitYear.year, benefitYear.start.toISOString(), "→", benefitYear.end.toISOString());

    const { orders, hasNextPage } = scanCurrentPage(benefitYear);

    D.log(`Sending SCAN_ORDERS_RESULT: ${orders.length} orders, hasNextPage: ${hasNextPage}`);
    await chrome.runtime.sendMessage({ type: "SCAN_ORDERS_RESULT", orders, hasNextPage });
    D.log("SCAN_ORDERS_RESULT sent successfully");

    if (hasNextPage) {
      const nextBtn = document.querySelector(".a-pagination .a-last a") as HTMLAnchorElement | null;
      D.log("Next page button:", nextBtn?.href ?? "NOT FOUND");
      if (nextBtn?.href) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        window.location.href = nextBtn.href;
      }
    }
  } catch (err) {
    D.error("runScan() threw:", err);
    try {
      await chrome.runtime.sendMessage({ type: "SCAN_ORDERS_ERROR", message: String(err) });
    } catch (msgErr) {
      D.error("Also failed to send error message:", msgErr);
    }
  } finally {
    scanInProgress = false;
  }
}

async function runCapture(orderId: string) {
  D.log("runCapture() for orderId:", orderId);
  try {
    const dataUrl = await captureOrderReceipt();
    await chrome.runtime.sendMessage({ type: "CAPTURE_INVOICE_RESULT", orderId, dataUrl });
  } catch (err) {
    D.error("runCapture() threw:", err);
    await chrome.runtime.sendMessage({ type: "CAPTURE_INVOICE_ERROR", orderId, message: String(err) });
  }
}

// ── Check state on load ───────────────────────────────────────────────────────
chrome.storage.local.get("appState", (result) => {
  const state = result["appState"] as AppState | undefined;
  D.log("Storage read on load. currentStep:", state?.currentStep ?? "NO STATE");

  if (!state) return;

  if (state.currentStep === "scanning_amazon") {
    D.log("Step is scanning_amazon — triggering scan from on-load check");
    void runScan(state);
  } else if (state.currentStep === "capturing_invoices") {
    const urlOrderId = extractOrderIdFromUrl(window.location.href);
    D.log("Step is capturing_invoices. orderId from URL:", urlOrderId);
    if (urlOrderId) void runCapture(urlOrderId);
  } else {
    D.log("No action needed for step:", state.currentStep);
  }
});

// ── React to storage changes ──────────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes) => {
  const newState = changes["appState"]?.newValue as AppState | undefined;
  if (!newState) return;
  D.log("Storage changed. New step:", newState.currentStep, "scanInProgress:", scanInProgress);

  if (newState.currentStep === "scanning_amazon" && !scanInProgress) {
    D.log("Step changed to scanning_amazon — triggering scan from onChanged");
    void runScan(newState);
  }
});

// ── Direct message fallback ───────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: { type: string; orderId?: string }, _sender, sendResponse) => {
  D.log("Message received:", message.type);
  if (message.type === "CAPTURE_INVOICE" && message.orderId) {
    void runCapture(message.orderId).then(() => sendResponse({ ok: true }));
    return true;
  }
});

function extractOrderIdFromUrl(url: string): string | null {
  const match = /orderID=(\d{3}-\d{7}-\d{7})/.exec(url);
  return match?.[1] ?? null;
}

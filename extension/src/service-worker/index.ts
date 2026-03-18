/**
 * FSA Claim Automation - Service Worker (Background Script)
 *
 * Central message router and workflow coordinator.
 * Handles all cross-component communication and orchestrates the workflow.
 *
 * IMPORTANT: MV3 service workers are ephemeral. All state MUST be persisted
 * to chrome.storage.local. Do not rely on in-memory state surviving between events.
 */

import type {
  PopupToSWMessage,
  AmazonToSWMessage,
  NaviaToSWMessage,
} from "@/types";
import type { Claim, ClaimItem, AmazonOrder } from "@/types";
import {
  readAppState,
  updateAppState,
  writeInvoice,
  readInvoice,
  clearAllData,
} from "@/lib/storage";
import { getBenefitYear } from "@/lib/benefit-year";
import { checkEligibility, getNaviaExpenseType } from "@/lib/eligibility";
import { sendToTab } from "@/lib/messaging";
import { logger } from "@/lib/logger";
import { openAmazonOrderHistory, openNaviaPortal, navigateTab } from "./tab-coordinator";

// Always-on logger for the service worker console
const SW = {
  log: (...a: unknown[]) => console.log("[FSA:sw]", ...a),
  error: (...a: unknown[]) => console.error("[FSA:sw]", ...a),
};

// Keep track of active tab IDs in memory (OK to lose on SW restart - recoverable)
let amazonTabId: number | undefined;
let naviaTabId: number | undefined;

// ─────────────────────────────────────────────
// Install / startup
// ─────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  SW.log("Extension installed/updated. Reason:", details.reason);
  // Only clear state on a fresh install, not on extension reloads/updates.
  // Use the Reset button in the popup to clear manually during development.
  if (details.reason === "install") {
    void clearAllData().then(() => SW.log("State cleared on fresh install"));
  }
});

// Disable navigation preload — we don't use it and it causes console spam.
// Must run in activate (not install): navigationPreload requires an active worker.
self.addEventListener("activate", (event) => {
  const sw = self as unknown as ServiceWorkerGlobalScope;
  const disable = sw.registration?.navigationPreload?.disable();
  if (disable) {
    (event as ExtendableEvent).waitUntil(disable);
  }
});

// ─────────────────────────────────────────────
// Message Router
// ─────────────────────────────────────────────

type IncomingMessage = PopupToSWMessage | AmazonToSWMessage | NaviaToSWMessage;

chrome.runtime.onMessage.addListener(
  (message: IncomingMessage, sender, sendResponse) => {
    // Handle async in a void wrapper to return true for async sendResponse
    void handleMessage(message, sender).then(sendResponse).catch((err: unknown) => {
      logger.error("Message handler error:", err);
      sendResponse({ error: String(err) });
    });
    return true; // Keep message channel open for async response
  }
);

async function handleMessage(
  message: IncomingMessage,
  _sender: chrome.runtime.MessageSender
): Promise<unknown> {
  SW.log("Message received:", message.type);

  switch (message.type) {
    // ── Popup messages ──────────────────────────────────────
    case "START_WORKFLOW": {
      const benefitYear = getBenefitYear(message.benefitYear);
      await updateAppState({
        currentStep: "navigate_amazon",
        benefitYear,
        orders: [],
        selectedOrderIds: [],
        claims: [],
        lastError: undefined,
      });
      return { ok: true };
    }

    case "SCAN_ORDERS_REQUEST": {
      // Set state to scanning_amazon FIRST so the content script sees it on load.
      await updateAppState({ currentStep: "scanning_amazon" });
      // Navigate the Amazon tab to the year-filtered URL. Navigating forces a
      // fresh page load → content script runs fresh → reads scanning_amazon →
      // triggers scan immediately. Also scopes results to the correct benefit year.
      const scanState = await readAppState();
      amazonTabId = await openAmazonOrderHistory(scanState.benefitYear?.year);
      return { ok: true };
    }

    case "SELECT_ORDERS": {
      await updateAppState({
        selectedOrderIds: message.orderIds,
        currentStep: "capturing_invoices",
      });
      return { ok: true };
    }

    case "CAPTURE_INVOICES_REQUEST": {
      await updateAppState({ currentStep: "capturing_invoices" });
      const captureState = await readAppState();
      const firstPending = captureState.orders.find(
        (o) =>
          captureState.selectedOrderIds.includes(o.orderId) &&
          o.invoiceStatus === "pending"
      );
      if (firstPending) {
        // Navigate to the Amazon print invoice URL.
        // invoice-capture.ts auto-captures on load and sends CAPTURE_INVOICE_RESULT back.
        if (!amazonTabId) {
          amazonTabId = await openAmazonOrderHistory(captureState.benefitYear?.year);
        }
        await navigateToInvoice(amazonTabId, firstPending.orderId);
      }
      return { ok: true };
    }

    case "NAVIGATE_NAVIA": {
      await updateAppState({ currentStep: "navigate_navia" });
      naviaTabId = await openNaviaPortal();
      return { ok: true };
    }

    case "BEGIN_SUBMITTING": {
      await updateAppState({ currentStep: "submitting_claims" });
      return { ok: true };
    }

    case "FILL_CLAIM_REQUEST": {
      const fillState = await readAppState();
      const claim = fillState.claims.find((c) => c.id === message.claimId);
      if (!claim) {
        return { error: `Claim ${message.claimId} not found` };
      }
      // Always find the current Navia tab by URL — naviaTabId is in-memory and
      // lost on SW restarts. Finding the live tab is more reliable.
      const naviaTab = await findNaviaTab();
      if (!naviaTab) {
        return { error: "No Navia tab found. Please open Navia Benefits and navigate to the Submit Claim page." };
      }
      naviaTabId = naviaTab;
      await sendToTab(naviaTabId, { type: "FILL_CLAIM", claim });
      return { ok: true };
    }

    case "SKIP_CLAIM": {
      const skipState = await readAppState();
      const claims = skipState.claims.map((c) =>
        c.id === message.claimId ? { ...c, status: "skipped" as const } : c
      );
      await updateAppState({ claims });
      return { ok: true };
    }

    case "RESET_WORKFLOW": {
      await clearAllData();
      return { ok: true };
    }

    case "GET_STATE": {
      const state = await readAppState();
      return { type: "GET_STATE_RESPONSE", state };
    }

    // ── Amazon content script messages ──────────────────────
    case "SCAN_ORDERS_RESULT": {
      SW.log(`SCAN_ORDERS_RESULT: ${message.orders.length} orders, hasNextPage: ${message.hasNextPage}`);
      const scanState = await readAppState();
      const existingIds = new Set(scanState.orders.map((o) => o.orderId));
      const newOrders = message.orders.filter((o) => !existingIds.has(o.orderId));
      const allOrders = [...scanState.orders, ...newOrders];
      SW.log(`Total orders accumulated: ${allOrders.length} (${newOrders.length} new)`);

      await updateAppState({
        orders: allOrders,
        currentStep: message.hasNextPage ? "scanning_amazon" : "reviewing_orders",
        lastScanAt: new Date().toISOString(),
      });
      return { ok: true };
    }

    case "SCAN_ORDERS_ERROR": {
      SW.error("SCAN_ORDERS_ERROR:", message.message);
      await updateAppState({ currentStep: "reviewing_orders", lastError: message.message });
      return { ok: true };
    }

    case "CAPTURE_INVOICE_RESULT": {
      await writeInvoice(message.orderId, message.dataUrl);
      // Update order invoice status
      const captureResultState = await readAppState();
      const orders = captureResultState.orders.map((o) =>
        o.orderId === message.orderId
          ? { ...o, invoiceStatus: "captured" as const }
          : o
      );
      const selectedOrders = orders.filter((o) =>
        captureResultState.selectedOrderIds.includes(o.orderId)
      );
      const allCaptured = selectedOrders.every(
        (o) => o.invoiceStatus === "captured"
      );

      if (allCaptured) {
        // Build Claim objects from captured orders
        const claims = await buildClaimsFromOrders(selectedOrders);
        SW.log(`Built ${claims.length} claims from ${selectedOrders.length} orders`);
        await updateAppState({ orders, claims, currentStep: "navigate_navia" });
      } else {
        await updateAppState({ orders, currentStep: "capturing_invoices" });
        // Navigate to the next pending invoice
        const nextPending = orders.find(
          (o) =>
            captureResultState.selectedOrderIds.includes(o.orderId) &&
            o.invoiceStatus === "pending"
        );
        if (nextPending && amazonTabId) {
          await navigateToInvoice(amazonTabId, nextPending.orderId);
        }
      }
      return { ok: true };
    }

    case "CAPTURE_INVOICE_ERROR": {
      const captureErrState = await readAppState();
      const orders = captureErrState.orders.map((o) =>
        o.orderId === message.orderId
          ? { ...o, invoiceStatus: "failed" as const }
          : o
      );
      await updateAppState({ orders, lastError: message.message });
      return { ok: true };
    }

    // ── Navia content script messages ───────────────────────
    case "FILL_CLAIM_READY": {
      const fillReadyState = await readAppState();
      const claimsReady = fillReadyState.claims.map((c) =>
        c.id === message.claimId ? { ...c, status: "reviewing" as const } : c
      );
      await updateAppState({ claims: claimsReady, currentStep: "submitting_claims" });
      return { ok: true };
    }

    case "FILL_CLAIM_SUBMITTED": {
      const submittedState = await readAppState();
      const claimsSubmitted = submittedState.claims.map((c) =>
        c.id === message.claimId
          ? { ...c, status: "submitted" as const, submittedAt: new Date().toISOString() as unknown as Date }
          : c
      );
      const allDone = claimsSubmitted.every(
        (c) => c.status === "submitted" || c.status === "skipped"
      );
      await updateAppState({
        claims: claimsSubmitted,
        currentStep: allDone ? "complete" : "submitting_claims",
      });
      return { ok: true };
    }

    case "FILL_CLAIM_ERROR": {
      const claimErrState = await readAppState();
      const claimsWithError = claimErrState.claims.map((c) =>
        c.id === message.claimId
          ? { ...c, status: "failed" as const, errorMessage: message.message }
          : c
      );
      await updateAppState({ claims: claimsWithError, lastError: message.message });
      return { ok: true };
    }

    default:
      logger.warn("Unknown message type:", (message as { type: string }).type);
      return { error: "Unknown message type" };
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Builds Claim objects from captured Amazon orders.
 * One claim per order. Amount = order.totalAmount (per-item prices are not
 * available on the order history page; the order total is correct).
 */
async function buildClaimsFromOrders(orders: AmazonOrder[]): Promise<Claim[]> {
  const claims: Claim[] = [];

  for (const order of orders) {
    const invoiceDataUrl = (await readInvoice(order.orderId)) ?? "";

    // Determine expense type from the first eligible item
    const firstEligible = order.eligibleItems[0];
    const eligibility = firstEligible
      ? checkEligibility(firstEligible.title)
      : null;
    const expenseType = eligibility?.category
      ? getNaviaExpenseType(eligibility.category)
      : "OTC";

    const description = order.eligibleItems
      .map((i) => i.title)
      .join("; ");

    const claimItem: ClaimItem = {
      description,
      serviceDate: order.orderDate,
      amount: order.totalAmount,
      expenseType,
    };

    claims.push({
      id: `claim-${order.orderId}`,
      sourceOrderId: order.orderId,
      items: [claimItem],
      totalAmount: order.totalAmount,
      invoiceDataUrl,
      status: "draft",
      createdAt: new Date(),
    });
  }

  return claims;
}

/**
 * Navigates the Amazon tab to the printable invoice page for a given order.
 * invoice-capture.ts is injected on this URL and auto-captures on load.
 */
/**
 * Finds any open Navia Benefits tab by URL pattern.
 * More reliable than the in-memory naviaTabId which is lost on SW restarts.
 */
async function findNaviaTab(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ url: "https://*.naviabenefits.com/*" });
  const tab = tabs[0];
  if (tab?.id) {
    SW.log("Found Navia tab:", tab.id, tab.url);
    return tab.id;
  }
  SW.log("No Navia tab found");
  return undefined;
}

async function navigateToInvoice(tabId: number, orderId: string): Promise<void> {
  const url = `https://www.amazon.com/gp/css/summary/print.html?orderID=${orderId}`;
  SW.log(`Navigating to invoice: ${url}`);
  await navigateTab(tabId, url);
}

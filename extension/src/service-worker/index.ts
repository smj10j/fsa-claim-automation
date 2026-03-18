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
import { downloadClaimPackage, defaultExportFolderName } from "@/lib/claim-export";

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
      const selectState = await readAppState();
      const wasInvoiceScanned = selectState.orders.some((o) => o.invoiceScanStatus != null);

      if (wasInvoiceScanned) {
        // New PRD-011 flow: invoices already captured during scanning_invoices step.
        // Build claims now and go directly to navigate_navia.
        const selectedOrders = selectState.orders.filter((o) =>
          message.orderIds.includes(o.orderId)
        );
        const claims = await buildClaimsFromOrders(selectedOrders);
        SW.log(`SELECT_ORDERS (new flow): built ${claims.length} claims`);
        await updateAppState({
          selectedOrderIds: message.orderIds,
          exportFolderName: message.exportFolderName,
          claims,
          currentStep: "navigate_navia",
        });

        // Download claim package
        const folderName = message.exportFolderName ?? defaultExportFolderName();
        try {
          await downloadClaimPackage(claims, selectState.benefitYear, folderName);
        } catch (err) {
          SW.error("Claim package download failed:", err);
        }
      } else {
        // Legacy flow: invoices not yet captured — go to capturing_invoices step.
        await updateAppState({
          selectedOrderIds: message.orderIds,
          exportFolderName: message.exportFolderName,
          currentStep: "capturing_invoices",
        });
      }
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
      // Ensure the content script is running — it may not be if the tab was
      // open before the extension was loaded/reloaded.
      await ensureNaviaContentScript(naviaTabId);
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

      if (message.hasNextPage) {
        // More pages to scan — stay in scanning_amazon
        await updateAppState({ orders: allOrders, currentStep: "scanning_amazon", lastScanAt: new Date().toISOString() });
      } else {
        // All order history pages scanned — transition to invoice scanning
        SW.log(`History scan complete. Starting invoice scan for ${allOrders.length} orders.`);
        await updateAppState({
          orders: allOrders,
          currentStep: "scanning_invoices",
          lastScanAt: new Date().toISOString(),
          invoiceScanProgress: { total: allOrders.length, scanned: 0 },
        });
        // Kick off the first invoice
        const firstPending = allOrders.find((o) => o.invoiceScanStatus === "pending");
        if (firstPending) {
          if (!amazonTabId) amazonTabId = await openAmazonOrderHistory(scanState.benefitYear?.year);
          await navigateToInvoice(amazonTabId!, firstPending.orderId);
        } else {
          // No orders at all — go straight to review
          await updateAppState({ currentStep: "reviewing_orders" });
        }
      }
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

        // Download claim package to Downloads/<folderName>/
        const folderName =
          captureResultState.exportFolderName ?? defaultExportFolderName();
        try {
          await downloadClaimPackage(claims, captureResultState.benefitYear, folderName);
        } catch (err) {
          SW.error("Claim package download failed:", err);
        }
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

    // ── Invoice scan messages (scanning_invoices step) ───────
    case "INVOICE_SCAN_RESULT": {
      const { orderId, fsaEligibleAmountCents, dataUrl } = message;
      SW.log(`INVOICE_SCAN_RESULT [${orderId}]: fsaAmount=${fsaEligibleAmountCents ?? "none"}, screenshot=${dataUrl ? "yes" : "no"}`);

      const invoiceState = await readAppState();

      // Save screenshot if we got one (only when Amazon confirmed FSA eligibility)
      if (dataUrl) {
        await writeInvoice(orderId, dataUrl);
      }

      // Update this order's scan status
      const orders = invoiceState.orders.map((o) => {
        if (o.orderId !== orderId) return o;
        if (fsaEligibleAmountCents !== null) {
          return {
            ...o,
            invoiceScanStatus: "confirmed" as const,
            fsaEligibleAmount: fsaEligibleAmountCents,
            eligibilitySource: "amazon_label" as const,
            invoiceStatus: dataUrl ? "captured" as const : o.invoiceStatus,
          };
        }
        // No FSA label — check if keyword matching found anything (fallback)
        const hasKeywordMatch = o.eligibleItems.length > 0;
        return {
          ...o,
          invoiceScanStatus: "no_label" as const,
          ...(hasKeywordMatch ? { eligibilitySource: "keyword_match" as const } : {}),
        };
      });

      // Advance progress counter
      const scanned = (invoiceState.invoiceScanProgress?.scanned ?? 0) + 1;
      const total = invoiceState.invoiceScanProgress?.total ?? orders.length;
      SW.log(`Invoice scan progress: ${scanned} / ${total}`);

      // Find next pending order
      const nextPending = orders.find((o) => o.invoiceScanStatus === "pending");

      if (nextPending) {
        await updateAppState({
          orders,
          invoiceScanProgress: { total, scanned },
          currentStep: "scanning_invoices",
        });
        await navigateToInvoice(amazonTabId!, nextPending.orderId);
      } else {
        // All invoices scanned — transition to review
        const confirmedCount = orders.filter((o) => o.invoiceScanStatus === "confirmed").length;
        const keywordCount = orders.filter((o) => o.invoiceScanStatus === "no_label" && o.eligibleItems.length > 0).length;
        SW.log(`Invoice scan complete. Confirmed by Amazon: ${confirmedCount}, keyword-only hints: ${keywordCount}`);
        await updateAppState({
          orders,
          invoiceScanProgress: { total, scanned },
          currentStep: "reviewing_orders",
        });
      }
      return { ok: true };
    }

    case "INVOICE_SCAN_ERROR": {
      SW.error(`INVOICE_SCAN_ERROR [${message.orderId}]:`, message.message);
      const errState = await readAppState();
      // Mark this order as no_label and continue
      const orders = errState.orders.map((o) =>
        o.orderId === message.orderId
          ? { ...o, invoiceScanStatus: "no_label" as const }
          : o
      );
      const scanned = (errState.invoiceScanProgress?.scanned ?? 0) + 1;
      const total = errState.invoiceScanProgress?.total ?? orders.length;
      const nextPending = orders.find((o) => o.invoiceScanStatus === "pending");
      if (nextPending) {
        await updateAppState({ orders, invoiceScanProgress: { total, scanned } });
        await navigateToInvoice(amazonTabId!, nextPending.orderId);
      } else {
        await updateAppState({ orders, invoiceScanProgress: { total, scanned }, currentStep: "reviewing_orders" });
      }
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
 * One claim per order.
 *
 * Amount priority:
 *   1. order.fsaEligibleAmount — Amazon's own "FSA or HSA eligible: $X.XX" label (most accurate)
 *   2. order.totalAmount       — fallback when Amazon's label wasn't found
 */
async function buildClaimsFromOrders(orders: AmazonOrder[]): Promise<Claim[]> {
  const claims: Claim[] = [];

  for (const order of orders) {
    const invoiceDataUrl = (await readInvoice(order.orderId)) ?? "";

    // Use Amazon's confirmed FSA amount when available, otherwise fall back to order total
    const claimAmount = order.fsaEligibleAmount ?? order.totalAmount;
    SW.log(`[${order.orderId}] claim amount: $${(claimAmount / 100).toFixed(2)} (source: ${order.eligibilitySource ?? "total"})`);

    // Determine expense type from the first keyword-eligible item (best available signal)
    const firstEligible = order.eligibleItems[0];
    const eligibility = firstEligible
      ? checkEligibility(firstEligible.title)
      : null;
    const expenseType = getNaviaExpenseType(eligibility?.naviaExpense);

    const description = order.eligibleItems.length > 0
      ? order.eligibleItems.map((i) => i.title).join("; ")
      : `Amazon order ${order.orderId}`;

    const claimItem: ClaimItem = {
      description,
      serviceDate: order.orderDate,
      amount: claimAmount,
      expenseType,
    };

    claims.push({
      id: `claim-${order.orderId}`,
      sourceOrderId: order.orderId,
      items: [claimItem],
      totalAmount: claimAmount,
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
 * Ensures the Navia content script is running in the given tab.
 * Chrome doesn't re-inject content scripts into tabs that were open before
 * the extension was loaded or reloaded, so we inject programmatically if needed.
 */
async function ensureNaviaContentScript(tabId: number): Promise<void> {
  // Check if the content script is already running by reading the window flag
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => !!(window as Record<string, unknown>)["__fsaNaviaLoaded"],
  });

  if (result?.result) {
    SW.log("Navia content script already running");
    return;
  }

  // Not running — inject using the path from the built manifest
  SW.log("Navia content script not found, injecting...");
  const manifest = chrome.runtime.getManifest();
  const cs = manifest.content_scripts?.find((c) =>
    c.matches?.some((m) => m.includes("naviabenefits"))
  );
  const file = cs?.js?.[0];
  if (!file) {
    SW.error("Could not find Navia content script path in manifest");
    return;
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
  // Brief pause for the script to initialize before we send a message
  await new Promise((r) => setTimeout(r, 300));
  SW.log("Navia content script injected");
}

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

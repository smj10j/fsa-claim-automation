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
import {
  readAppState,
  updateAppState,
  writeInvoice,
  readInvoice,
  clearAllData,
} from "@/lib/storage";
import { getBenefitYear } from "@/lib/benefit-year";
import { checkEligibility, getNaviaExpenseType } from "@/lib/eligibility";
import type { AmazonOrder, Claim, ClaimItem } from "@/types";
import { sendToTab } from "@/lib/messaging";
import { logger } from "@/lib/logger";
import { openAmazonOrderHistory, openNaviaPortal } from "./tab-coordinator";

// Keep track of active tab IDs in memory (OK to lose on SW restart - recoverable)
let amazonTabId: number | undefined;
let naviaTabId: number | undefined;

// ─────────────────────────────────────────────
// Claim creation
// ─────────────────────────────────────────────

/**
 * Creates Claim objects from captured orders + their stored invoices.
 * Called once all invoices have been successfully captured.
 */
async function createClaimsFromOrders(orders: AmazonOrder[]): Promise<Claim[]> {
  const claims: Claim[] = [];

  for (const order of orders) {
    const invoiceDataUrl = await readInvoice(order.orderId);
    if (!invoiceDataUrl) {
      logger.warn(`No invoice found for order ${order.orderId}, skipping claim creation`);
      continue;
    }

    const items: ClaimItem[] = order.eligibleItems.map((item) => {
      const eligibility = checkEligibility(item.title);
      const expenseType = eligibility.category
        ? getNaviaExpenseType(eligibility.category)
        : "OTC";
      return {
        description: item.title,
        serviceDate: order.orderDate,
        amount: item.totalPrice,
        expenseType,
      };
    });

    if (items.length === 0) {
      logger.warn(`Order ${order.orderId} has no eligible items, skipping claim creation`);
      continue;
    }

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    claims.push({
      id: `claim-${order.orderId}`,
      sourceOrderId: order.orderId,
      items,
      totalAmount,
      invoiceDataUrl,
      status: "draft",
      createdAt: new Date(),
    });
  }

  return claims;
}

// ─────────────────────────────────────────────
// Install / startup
// ─────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  logger.log("Extension installed/updated");
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
  logger.log("SW received:", message.type);

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
      await updateAppState({ currentStep: "scanning_amazon" });
      amazonTabId = await openAmazonOrderHistory();
      // Content script will receive SCAN_ORDERS message via storage state change
      // or we can send it directly:
      const state = await readAppState();
      await sendToTab(amazonTabId, {
        type: "SCAN_ORDERS",
        benefitYearStart: state.benefitYear.start.toISOString(),
        benefitYearEnd: state.benefitYear.end.toISOString(),
      });
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
      const selectedOrders = captureState.orders.filter((o) =>
        captureState.selectedOrderIds.includes(o.orderId)
      );
      // Trigger capture for each order sequentially
      // Content scripts will send CAPTURE_INVOICE_RESULT back
      for (const order of selectedOrders) {
        if (!amazonTabId) {
          amazonTabId = await openAmazonOrderHistory();
        }
        await sendToTab(amazonTabId, {
          type: "CAPTURE_INVOICE",
          orderId: order.orderId,
        });
      }
      return { ok: true };
    }

    case "NAVIGATE_NAVIA": {
      await updateAppState({ currentStep: "navigate_navia" });
      naviaTabId = await openNaviaPortal();
      return { ok: true };
    }

    case "FILL_CLAIM_REQUEST": {
      const fillState = await readAppState();
      const claim = fillState.claims.find((c) => c.id === message.claimId);
      if (!claim) {
        return { error: `Claim ${message.claimId} not found` };
      }
      if (!naviaTabId) {
        naviaTabId = await openNaviaPortal();
      }
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
      const scanState = await readAppState();
      const existingIds = new Set(scanState.orders.map((o) => o.orderId));
      const newOrders = message.orders.filter(
        (o) => !existingIds.has(o.orderId)
      );
      const allOrders = [...scanState.orders, ...newOrders];

      await updateAppState({
        orders: allOrders,
        currentStep: message.hasNextPage ? "scanning_amazon" : "reviewing_orders",
        lastScanAt: new Date().toISOString(),
      });
      return { ok: true };
    }

    case "SCAN_ORDERS_ERROR": {
      await updateAppState({
        currentStep: "reviewing_orders",
        lastError: message.message,
      });
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
      const allCaptured = selectedOrders.every((o) => o.invoiceStatus === "captured");

      if (allCaptured) {
        const claims = await createClaimsFromOrders(selectedOrders);
        logger.log(`Created ${claims.length} claims from ${selectedOrders.length} orders`);
        await updateAppState({ orders, claims, currentStep: "navigate_navia" });
      } else {
        await updateAppState({ orders });
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

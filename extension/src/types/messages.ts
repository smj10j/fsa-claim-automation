import type { AmazonOrder } from "./order";
import type { Claim } from "./claim";
import type { AppState, WorkflowStep } from "./state";

// Popup → Service Worker
export type PopupToSWMessage =
  | { type: "START_WORKFLOW"; benefitYear?: number }
  | { type: "SCAN_ORDERS_REQUEST" }
  | { type: "SELECT_ORDERS"; orderIds: string[]; exportFolderName?: string }
  | { type: "CAPTURE_INVOICES_REQUEST" }
  | { type: "NAVIGATE_NAVIA" }
  | { type: "BEGIN_SUBMITTING" }
  | { type: "FILL_CLAIM_REQUEST"; claimId: string }
  | { type: "SKIP_CLAIM"; claimId: string }
  | { type: "RESET_WORKFLOW" }
  | { type: "GET_STATE" };

// Service Worker → Popup
export type SWToPopupMessage =
  | { type: "STATE_UPDATED"; state: Partial<AppState> }
  | { type: "GET_STATE_RESPONSE"; state: AppState }
  | { type: "ERROR"; message: string; step: WorkflowStep };

// Service Worker → Amazon Content Script
export type SWToAmazonMessage =
  | { type: "SCAN_ORDERS"; benefitYearStart: string; benefitYearEnd: string }
  | { type: "CAPTURE_INVOICE"; orderId: string };

// Amazon Content Script → Service Worker
export type AmazonToSWMessage =
  | { type: "SCAN_ORDERS_RESULT"; orders: AmazonOrder[]; hasNextPage: boolean }
  | { type: "SCAN_ORDERS_ERROR"; message: string }
  | { type: "CAPTURE_INVOICE_RESULT"; orderId: string; dataUrl: string }
  | { type: "CAPTURE_INVOICE_ERROR"; orderId: string; message: string }
  /**
   * Result of visiting an order's invoice page during scanning_invoices.
   * fsaEligibleAmountCents: null means "FSA or HSA eligible" label not found.
   * dataUrl: null means screenshot capture failed (independent of label presence).
   */
  | { type: "INVOICE_SCAN_RESULT"; orderId: string; fsaEligibleAmountCents: number | null; dataUrl: string | null }
  | { type: "INVOICE_SCAN_ERROR"; orderId: string; message: string };

// Service Worker → Navia Content Script
export type SWToNaviaMessage = { type: "FILL_CLAIM"; claim: Claim };

// Navia Content Script → Service Worker
export type NaviaToSWMessage =
  | { type: "FILL_CLAIM_READY"; claimId: string }
  | { type: "FILL_CLAIM_SUBMITTED"; claimId: string }
  | { type: "FILL_CLAIM_ERROR"; claimId: string; message: string };

// Union of all messages
export type ExtensionMessage =
  | PopupToSWMessage
  | SWToPopupMessage
  | SWToAmazonMessage
  | AmazonToSWMessage
  | SWToNaviaMessage
  | NaviaToSWMessage;

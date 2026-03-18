import type { AmazonOrder, BenefitYear } from "./order";
import type { Claim } from "./claim";

export type WorkflowStep =
  | "idle"
  | "navigate_amazon"
  | "scanning_amazon"
  | "scanning_invoices" // NEW: auto-visits each order invoice, extracts FSA label + captures screenshot
  | "reviewing_orders"
  | "capturing_invoices" // kept for type compat; no longer entered in new flow
  | "navigate_navia"
  | "submitting_claims"
  | "complete";

export type AppState = {
  currentStep: WorkflowStep;
  benefitYear: BenefitYear;
  orders: AmazonOrder[];
  selectedOrderIds: string[];
  claims: Claim[];
  exportFolderName?: string; // Defaults to "yyyy-mm-dd" of capture date if not set
  lastError?: string;
  lastScanAt?: string; // ISO string (Date not JSON-serializable)
  /** Progress through the scanning_invoices step */
  invoiceScanProgress?: { total: number; scanned: number };
};

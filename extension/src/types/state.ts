import type { AmazonOrder, BenefitYear } from "./order";
import type { Claim } from "./claim";

export type WorkflowStep =
  | "idle"
  | "navigate_amazon"
  | "scanning_amazon"
  | "reviewing_orders"
  | "capturing_invoices"
  | "navigate_navia"
  | "submitting_claims"
  | "complete";

export type AppState = {
  currentStep: WorkflowStep;
  benefitYear: BenefitYear;
  orders: AmazonOrder[];
  selectedOrderIds: string[];
  claims: Claim[];
  lastError?: string;
  lastScanAt?: string; // ISO string (Date not JSON-serializable)
};

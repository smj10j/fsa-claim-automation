export type BenefitYear = {
  year: number;
  start: Date;
  end: Date;
  label: string;
};

import type { NaviaExpense } from "./eligibility";

export type OrderItem = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number; // cents
  totalPrice: number; // cents
  category?: string;
  imageUrl?: string;
  isEligible: boolean;
  eligibilityReason?: string;
  naviaExpense?: NaviaExpense; // matched Navia expense category
};

export type InvoiceStatus = "pending" | "captured" | "failed";

/** How the FSA eligibility of this order was determined */
export type EligibilitySource = "amazon_label" | "keyword_match";

/**
 * Tracks where we are in the invoice scan for this order.
 *   pending   - not yet visited
 *   confirmed - visited; Amazon's "FSA or HSA eligible" label found → fsaEligibleAmount set
 *   no_label  - visited; label not present (Amazon does not confirm FSA eligibility)
 */
export type InvoiceScanStatus = "pending" | "confirmed" | "no_label";

export type AmazonOrder = {
  orderId: string;
  orderDate: Date;
  totalAmount: number; // cents — full order total
  items: OrderItem[];
  eligibleItems: OrderItem[]; // keyword-matched items (may be empty for label-only orders)
  invoiceStatus: InvoiceStatus;
  orderDetailUrl: string;
  /** Amazon's own "FSA or HSA eligible: $X.XX" amount (cents). Set when invoiceScanStatus="confirmed". */
  fsaEligibleAmount?: number;
  /** How eligibility was determined for this order */
  eligibilitySource?: EligibilitySource;
  /** Invoice scan progress for this order */
  invoiceScanStatus?: InvoiceScanStatus;
};

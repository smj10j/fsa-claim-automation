/**
 * Coverage status per Navia Benefits' official FSA expense list.
 *   covered     - Eligible, no extra documentation needed
 *   lmn         - Eligible with a Letter of Medical Necessity from a provider
 *   prescription - Eligible with a valid prescription
 *   not-covered - Explicitly ineligible
 */
export type NaviaStatus = "covered" | "lmn" | "prescription" | "not-covered";

export type NaviaExpense = {
  /** Official Navia expense category name */
  name: string;
  status: NaviaStatus;
  /** Amazon product title substrings (case-insensitive) that match this expense */
  keywords: string[];
  /** Navia's official explanation — shown in the UI tooltip; especially useful for lmn/prescription/not-covered */
  notes?: string;
};

export type EligibilityResult = {
  isEligible: boolean; // true for covered, lmn, and prescription
  naviaExpense?: NaviaExpense;
  matchedKeyword?: string;
  reason?: string;
};

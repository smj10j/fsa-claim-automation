import { NAVIA_EXPENSES } from "@/constants/eligibility-list";
import type { EligibilityResult, NaviaExpense } from "@/types";

/**
 * Determines FSA eligibility for a product based on its title.
 * Matches against the Navia Benefits official Health Care FSA expense list.
 *
 * Returns isEligible=true for "covered", "lmn", and "prescription" statuses.
 * The naviaExpense field tells you which category matched and what docs are needed.
 */
export function checkEligibility(productTitle: string): EligibilityResult {
  const normalized = productTitle.toLowerCase().trim();

  for (const expense of NAVIA_EXPENSES) {
    for (const keyword of expense.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        const isEligible = expense.status !== "not-covered";
        return {
          isEligible,
          naviaExpense: expense,
          matchedKeyword: keyword,
          reason: `Matched "${keyword}" → ${expense.name} (${expense.status})`,
        };
      }
    }
  }

  return { isEligible: false };
}

/**
 * Returns the Navia expense name for use in claim exports and form filling.
 * Falls back to "OTC" if no expense is matched.
 */
export function getNaviaExpenseType(naviaExpense: NaviaExpense | undefined): string {
  return naviaExpense?.name ?? "OTC";
}

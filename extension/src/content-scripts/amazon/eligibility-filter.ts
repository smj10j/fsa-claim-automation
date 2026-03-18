import { checkEligibility } from "@/lib/eligibility";
import type { OrderItem } from "@/types";

/**
 * Applies FSA eligibility checking to a list of order items.
 * Returns items with isEligible, eligibilityReason, and naviaExpense set.
 */
export function filterEligibleItems(items: OrderItem[]): {
  allItems: OrderItem[];
  eligibleItems: OrderItem[];
} {
  const allItems = items.map((item) => {
    const result = checkEligibility(item.title);
    return {
      ...item,
      isEligible: result.isEligible,
      eligibilityReason: result.reason,
      naviaExpense: result.naviaExpense,
    };
  });

  const eligibleItems = allItems.filter((item) => item.isEligible);

  return { allItems, eligibleItems };
}

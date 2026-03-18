import { checkEligibility } from "@/lib/eligibility";
import type { OrderItem } from "@/types";

/**
 * Applies FSA eligibility checking to a list of order items.
 * Returns the items with isEligible and eligibilityReason set.
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
    };
  });

  const eligibleItems = allItems.filter((item) => item.isEligible);

  return { allItems, eligibleItems };
}

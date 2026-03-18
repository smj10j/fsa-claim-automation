import { ELIGIBILITY_RULES } from "@/constants/eligibility-list";
import type { EligibilityResult, FSACategory } from "@/types";

/**
 * Determines FSA eligibility for a product based on its title.
 *
 * Uses keyword matching against the ELIGIBILITY_RULES list.
 * Conservative approach: only flag items we're confident are eligible.
 *
 * @param productTitle - The product title from Amazon
 * @returns EligibilityResult with isEligible, category, and reason
 */
export function checkEligibility(productTitle: string): EligibilityResult {
  const normalized = productTitle.toLowerCase().trim();

  for (const rule of ELIGIBILITY_RULES) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return {
          isEligible: true,
          category: rule.category,
          reason: `Matched keyword: "${keyword}" (${rule.label})`,
        };
      }
    }
  }

  return { isEligible: false };
}

/**
 * Gets the display label for an FSA category.
 */
export function getCategoryLabel(category: FSACategory): string {
  const rule = ELIGIBILITY_RULES.find((r) => r.category === category);
  return rule?.label ?? category;
}

/**
 * Gets the Navia expense type value for a given FSA category.
 */
export function getNaviaExpenseType(category: FSACategory): string {
  const EXPENSE_TYPE_MAP: Record<FSACategory, string> = {
    otc_medicine: "OTC",
    first_aid: "OTC",
    medical_equipment: "Medical Equipment",
    vision: "Vision",
    dental: "Dental",
    feminine_hygiene: "OTC",
    baby_health: "Medical Equipment",
  };
  return EXPENSE_TYPE_MAP[category] ?? "OTC";
}

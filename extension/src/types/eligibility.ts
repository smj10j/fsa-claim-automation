export type FSACategory =
  | "otc_medicine"
  | "first_aid"
  | "medical_equipment"
  | "vision"
  | "dental"
  | "feminine_hygiene"
  | "baby_health";

export type EligibilityRule = {
  category: FSACategory;
  label: string;
  keywords: string[];
  asinAllowlist?: string[];
};

export type EligibilityResult = {
  isEligible: boolean;
  category?: FSACategory;
  reason?: string;
};

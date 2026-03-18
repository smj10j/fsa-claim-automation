/**
 * Navia Benefits portal DOM selectors for claim submission form.
 * Last verified: 2026-03-18 against live portal at app.naviabenefits.com/#/claimSub
 */

export const NAVIA_SELECTORS = {
  // ── Main claim page (#/claimSub) ──────────────────────────────────────────
  addItemButton: "#claim-add-item-btn",
  agreeToTerms: "input[name='agreeToTerms']",
  submitClaimButton: "#claim-submit-btn",

  // ── Wizard step 1: Document upload ────────────────────────────────────────
  fileUpload: "#fileDropRef",

  // ── Wizard navigation buttons ─────────────────────────────────────────────
  wizardNext: "#modal-wizard-next-btn",       // "next" / "add another claim"
  wizardConfirm: "#modal-wizard-confirm-btn", // "I'm finished"
  wizardBack: "#modal-wizard-back-btn",
  wizardCancel: "#modal-wizard-cancel-btn",

  // ── Wizard step 2: Claim detail fields ────────────────────────────────────
  benefitSelect: "select.zoom-select",
  serviceStartDate: "#fromDate",
  serviceEndDate: "#toDate",
  providerName: "#providerName",
  forWhom: "#forWhom",
  amount: "input[placeholder='Amount']",
  comments: "#claimComment",
} as const;

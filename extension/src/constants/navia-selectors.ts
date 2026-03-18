/**
 * Navia Benefits portal DOM selectors for claim submission form.
 *
 * IMPORTANT: These selectors need to be verified against the live Navia portal.
 * Update during Phase 4 implementation after manual DOM inspection.
 *
 * Last verified: TBD (not yet inspected)
 * @see https://app.naviabenefits.com
 */

export const NAVIA_SELECTORS = {
  // Navigation to claim submission
  submitClaimLink: [
    "a[href*='submit-claim']",
    "a[href*='submitclaim']",
  ],

  // Claim submission form fields
  // NOTE: These are placeholders - update after inspecting actual Navia form
  form: {
    expenseType: [
      "select[name*='expenseType']",
      "select[id*='expense-type']",
      "select[name*='expense_type']",
    ],
    serviceDate: [
      "input[name*='serviceDate']",
      "input[id*='service-date']",
      "input[type='date'][name*='date']",
    ],
    amount: [
      "input[name*='amount']",
      "input[id*='amount']",
      "input[type='number'][name*='amount']",
    ],
    description: [
      "textarea[name*='description']",
      "input[name*='description']",
      "textarea[id*='description']",
    ],
    patientName: [
      "select[name*='patient']",
      "input[name*='patient']",
      "select[id*='patient']",
    ],
    fileUpload: [
      "input[type='file']",
      "input[name*='receipt']",
      "input[name*='attachment']",
    ],
    submitButton: [
      "button[type='submit']",
      "input[type='submit']",
    ],
  },
} as const;

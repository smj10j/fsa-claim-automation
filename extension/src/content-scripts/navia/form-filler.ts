import { NAVIA_SELECTORS } from "@/constants/navia-selectors";
import { formatClaimDate } from "@/lib/benefit-year";
import { dataUrlToFile } from "@/lib/screenshot";
import { logger } from "@/lib/logger";
import type { Claim } from "@/types";

/**
 * Sets an input value in a way that triggers React/Angular synthetic events.
 * Direct `.value = x` assignment is ignored by framework-controlled inputs.
 */
function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value"
  )?.set;

  if (input instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
    nativeTextAreaValueSetter.call(input, value);
  } else if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  // Trigger both input and change events to satisfy framework state watchers
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Sets a select element value and triggers change event.
 */
function setSelectValue(select: HTMLSelectElement, value: string): void {
  // Try to find option by value or by text content
  let found = false;
  for (const option of select.options) {
    if (
      option.value.toLowerCase().includes(value.toLowerCase()) ||
      option.text.toLowerCase().includes(value.toLowerCase())
    ) {
      select.value = option.value;
      found = true;
      break;
    }
  }

  if (!found) {
    logger.warn(`Could not find option matching "${value}" in select`);
  }

  select.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Injects a file into a file input using the DataTransfer API.
 */
function injectFile(fileInput: HTMLInputElement, file: File): void {
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  fileInput.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Tries multiple selectors and returns the first matching element.
 */
function find<T extends Element>(
  selectors: readonly string[]
): T | null {
  for (const sel of selectors) {
    const el = document.querySelector<T>(sel);
    if (el) return el;
  }
  return null;
}

/**
 * Waits for an element to appear in the DOM.
 */
function waitForElement(
  selectors: readonly string[],
  timeoutMs = 5000
): Promise<Element> {
  return new Promise((resolve, reject) => {
    // Check immediately first
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        resolve(el);
        return;
      }
    }

    const observer = new MutationObserver(() => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          observer.disconnect();
          resolve(el);
          return;
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selectors.join(", ")}`));
    }, timeoutMs);
  });
}

/**
 * Delay helper for pacing form fills.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fills the Navia Benefits claim submission form with claim data.
 *
 * NOTE: Selectors in navia-selectors.ts are placeholders.
 * Update after inspecting the live Navia portal in Phase 4.
 */
export async function fillClaimForm(claim: Claim): Promise<void> {
  logger.log("Filling claim form for:", claim.id);

  const firstItem = claim.items[0];
  if (!firstItem) throw new Error("Claim has no items");

  // Wait for the form to appear (handles SPA navigation)
  await waitForElement(NAVIA_SELECTORS.form.submitButton);
  await delay(300); // Extra buffer for React rendering

  // 1. Expense type dropdown
  const expenseTypeEl = find<HTMLSelectElement>(NAVIA_SELECTORS.form.expenseType);
  if (expenseTypeEl) {
    setSelectValue(expenseTypeEl, firstItem.expenseType);
    await delay(200);
  } else {
    logger.warn("Could not find expense type field");
  }

  // 2. Service date
  const serviceDateEl = find<HTMLInputElement>(NAVIA_SELECTORS.form.serviceDate);
  if (serviceDateEl) {
    setInputValue(serviceDateEl, formatClaimDate(firstItem.serviceDate));
    await delay(200);
  } else {
    logger.warn("Could not find service date field");
  }

  // 3. Amount
  const amountEl = find<HTMLInputElement>(NAVIA_SELECTORS.form.amount);
  if (amountEl) {
    const dollars = (claim.totalAmount / 100).toFixed(2);
    setInputValue(amountEl, dollars);
    await delay(200);
  } else {
    logger.warn("Could not find amount field");
  }

  // 4. Description
  const descEl = find<HTMLInputElement | HTMLTextAreaElement>(
    NAVIA_SELECTORS.form.description
  );
  if (descEl) {
    setInputValue(descEl, firstItem.description);
    await delay(200);
  }

  // 5. File upload - inject the invoice screenshot
  const fileInputEl = find<HTMLInputElement>(NAVIA_SELECTORS.form.fileUpload);
  if (fileInputEl) {
    const file = dataUrlToFile(claim.invoiceDataUrl, "amazon-invoice.jpg");
    injectFile(fileInputEl, file);
    await delay(300);
  } else {
    logger.warn("Could not find file upload field");
  }

  logger.log("Form fill complete for claim:", claim.id);
}

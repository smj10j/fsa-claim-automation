import { NAVIA_SELECTORS } from "@/constants/navia-selectors";
import { formatClaimDate } from "@/lib/benefit-year";
import { dataUrlToFile } from "@/lib/screenshot";
import type { Claim } from "@/types";

// ── Low-level helpers ─────────────────────────────────────────────────────────

/**
 * Sets an input/textarea value in a way that triggers Angular synthetic events.
 * Direct `.value = x` is ignored by framework-controlled inputs.
 */
function setInputValue(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string
): void {
  const nativeInputSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;

  if (input instanceof HTMLTextAreaElement && nativeTextAreaSetter) {
    nativeTextAreaSetter.call(input, value);
  } else if (nativeInputSetter) {
    nativeInputSetter.call(input, value);
  } else {
    input.value = value;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new Event("blur", { bubbles: true }));
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
 * Waits for an element matching any selector to appear in the DOM.
 */
function waitForElement(
  selectors: readonly string[],
  timeoutMs = 8000
): Promise<Element> {
  return new Promise((resolve, reject) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) { resolve(el); return; }
    }

    const observer = new MutationObserver(() => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { observer.disconnect(); resolve(el); return; }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for: ${selectors.join(", ")}`));
    }, timeoutMs);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clickButton(selector: string): void {
  const btn = document.querySelector<HTMLElement>(selector);
  if (!btn) throw new Error(`Button not found: ${selector}`);
  btn.click();
}

// ── Step 1 custom dropdown interaction ───────────────────────────────────────

/**
 * Dumps all non-trivial elements in the wizard modal so we can identify
 * the benefit/plan-year dropdown structure from console output.
 */
function dumpStep1Elements(): void {
  // Cast className to string defensively — SVGElement.className is an object
  const className = (el: Element): string =>
    typeof el.className === "string" ? el.className : "";

  const all = Array.from(document.querySelectorAll("*"));
  const interesting = all.filter((el) => {
    const cls = className(el);
    const role = el.getAttribute("role") ?? "";
    const ngModel = el.getAttribute("ng-model") ?? "";
    const ngClick = el.getAttribute("ng-click") ?? "";
    return (
      cls.includes("zoom") ||
      cls.includes("select") ||
      cls.includes("dropdown") ||
      cls.includes("benefit") ||
      cls.includes("plan") ||
      role === "combobox" ||
      role === "listbox" ||
      role === "option" ||
      ngModel !== "" ||
      ngClick !== ""
    );
  });

  console.log(
    `[FSA:navia:filler] Step 1 candidate elements (${interesting.length}):`,
    interesting
      .map(
        (el) =>
          `<${el.tagName.toLowerCase()}` +
          ` class="${className(el).slice(0, 80)}"` +
          ` id="${el.id}"` +
          ` role="${el.getAttribute("role") ?? ""}"` +
          ` ng-model="${el.getAttribute("ng-model") ?? ""}"` +
          ` ng-click="${el.getAttribute("ng-click") ?? ""}"` +
          ` text="${el.textContent?.trim().slice(0, 40) ?? ""}">`)
      .join("\n  ")
  );
}

/**
 * Clicks a custom Angular dropdown trigger on Step 1, waits for an option list
 * to appear, then clicks the first option whose text contains `matchText`.
 *
 * Navia renders benefit and plan-year as custom components (not native <select>).
 * We open the dropdown by clicking the trigger element, wait for an option list
 * (ul/li or div/span), then click the matching option.
 *
 * @param triggerSelector  CSS selector for the clickable dropdown trigger
 * @param matchText        Text to match in the opened option list
 * @param label            Human-readable name for logging
 */
async function clickCustomDropdownOption(
  triggerSelector: string,
  matchText: string,
  label: string
): Promise<boolean> {
  const trigger = document.querySelector<HTMLElement>(triggerSelector);
  if (!trigger) {
    console.log(`[FSA:navia:filler] ${label} trigger not found: ${triggerSelector}`);
    return false;
  }

  console.log(`[FSA:navia:filler] Clicking ${label} dropdown trigger...`);
  trigger.click();
  await delay(400);

  // After opening, look for option list elements that appeared in the DOM.
  // Common patterns: <li>, <div> or <a> inside a dropdown container.
  const optionCandidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "ul li, [role='option'], [role='listbox'] *, .dropdown-menu li, .dropdown-item"
    )
  ).filter((el) => el.textContent?.toLowerCase().includes(matchText.toLowerCase()));

  if (optionCandidates.length === 0) {
    console.log(
      `[FSA:navia:filler] No option containing "${matchText}" found after opening ${label}. ` +
      `Visible list items: ${Array.from(document.querySelectorAll("ul li, [role='option']"))
        .map((e) => `"${e.textContent?.trim().slice(0, 40)}"`)
        .join(", ")}`
    );
    return false;
  }

  const target = optionCandidates[0];
  console.log(
    `[FSA:navia:filler] Clicking ${label} option: "${target.textContent?.trim()}"`
  );
  target.click();
  await delay(300);
  return true;
}

/**
 * Selects the FSA benefit type on wizard Step 1.
 *
 * The Navia Step 1 wizard has two custom dropdown components (not native <select>):
 *   - Benefit type (e.g. "Health Care FSA")
 *   - Plan year date range (e.g. "01/01/2025 - 12/31/2025")
 *
 * We discover the trigger selectors from the DOM dump logged above and try the
 * most common Navia/AngularJS custom dropdown patterns in order.
 *
 * TODO: When generalizing for HSA/HRA/DCFSA members, derive the matchText from
 *   the member's enrolled account type instead of hard-coding "FSA".
 */
async function selectStep1Benefit(): Promise<void> {
  // Common selectors for the benefit type dropdown trigger on Navia Step 1.
  // The order reflects likelihood based on AngularJS custom select patterns.
  const triggerSelectors = [
    // ng-model on the select/div element itself
    "[ng-model*='benefit']",
    "[ng-model*='Benefit']",
    "[ng-model*='account']",
    // Class-based patterns
    ".zoom-select",
    "select.zoom-select",
    // aria patterns
    "[aria-label*='benefit' i]",
    "[aria-label*='account' i]",
    // First select-like element in the modal (fallback)
    ".modal-body select:first-of-type",
    ".modal select:first-of-type",
  ];

  for (const sel of triggerSelectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;

    console.log(`[FSA:navia:filler] Trying benefit trigger: ${sel}`);

    // If it's a native <select>, use the native setter + AngularJS triggerHandler
    if (el instanceof HTMLSelectElement) {
      await setSelectValueAngular(el, "FSA");
      return;
    }

    // Otherwise click-based interaction
    const ok = await clickCustomDropdownOption(sel, "FSA", "benefit");
    if (ok) return;
  }

  console.log(
    "[FSA:navia:filler] Could not auto-select benefit — check step 1 discovery output above"
  );
}

/**
 * Sets a native <select> value in a way that works with AngularJS ng-model.
 *
 * Three layers of defense:
 * 1. Wait for options to populate (they may load asynchronously via $http).
 * 2. Use the native HTMLSelectElement value setter so Angular's overridden
 *    property doesn't silently swallow the assignment.
 * 3. Fire change via angular.element().triggerHandler() if Angular is on the
 *    page, so the digest cycle picks up the new value and doesn't reset it.
 */
async function setSelectValueAngular(
  select: HTMLSelectElement,
  matchText: string
): Promise<void> {
  // Wait up to 3 s for options to populate (async-loaded ng-options)
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const live = Array.from(select.options).filter(
      (o) => o.value !== "" && o.value !== "?"
    );
    if (live.length > 0) break;
    await delay(200);
  }

  const options = Array.from(select.options);
  console.log(
    "[FSA:navia:filler] Select options:",
    options.map((o) => `${o.value}="${o.text}"`).join(", ")
  );

  const target =
    options.find(
      (o) =>
        o.value !== "" &&
        o.value !== "?" &&
        o.text.toLowerCase().includes(matchText.toLowerCase())
    ) ?? options.find((o) => o.value !== "" && o.value !== "?");

  if (!target) {
    console.log("[FSA:navia:filler] No selectable option found for:", matchText);
    return;
  }

  // Use native setter to bypass framework-overridden .value
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value"
  )?.set;
  if (nativeSetter) {
    nativeSetter.call(select, target.value);
  } else {
    select.value = target.value;
  }

  select.dispatchEvent(new Event("focus", { bubbles: true }));
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
  select.dispatchEvent(new Event("blur", { bubbles: true }));

  // AngularJS: trigger through Angular's own event layer so $digest picks it up
  try {
    const win = window as unknown as {
      angular?: {
        element: (el: Element) => { triggerHandler: (ev: string) => void };
      };
    };
    if (win.angular) {
      win.angular.element(select).triggerHandler("change");
      console.log("[FSA:navia:filler] Triggered AngularJS change handler");
    }
  } catch {
    // angular not accessible — DOM events only
  }

  console.log(
    `[FSA:navia:filler] Set select: "${target.text}" (value: ${target.value})`
  );
}

// ── Main form fill ────────────────────────────────────────────────────────────

/**
 * Fills the Navia Benefits claim submission multi-step wizard with claim data.
 *
 * Wizard flow:
 *   Main page  → click "Add item to claim"
 *   Step 1     → select benefit (custom dropdown) + upload invoice → click Next
 *   Step 2     → fill claim details → click "I'm finished"
 *   Main page  → agreeToTerms checked → user reviews and clicks Submit
 */
export async function fillClaimForm(claim: Claim): Promise<void> {
  console.log("[FSA:navia:filler] Starting fillClaimForm for:", claim.id);

  const firstItem = claim.items[0];
  if (!firstItem) throw new Error("Claim has no items");

  // ── Step 0: Click "Add item to claim" ────────────────────────────────────
  console.log("[FSA:navia:filler] Waiting for #claim-add-item-btn...");
  await waitForElement([NAVIA_SELECTORS.addItemButton]);
  await delay(300);
  clickButton(NAVIA_SELECTORS.addItemButton);
  console.log("[FSA:navia:filler] Clicked add item button");

  // ── Step 1: Benefit dropdown + file upload ────────────────────────────────
  // Wait for wizard modal to open (cancel button is always rendered)
  await waitForElement([NAVIA_SELECTORS.wizardCancel]);
  await delay(600); // let Angular finish rendering

  // Dump Step 1 DOM so we can see the benefit/date dropdown structure
  dumpStep1Elements();

  // Select FSA benefit type (custom Angular dropdown on Step 1)
  await selectStep1Benefit();

  // Upload invoice file
  console.log("[FSA:navia:filler] Waiting for file upload input (#fileDropRef)...");
  const fileInputEl = await waitForElement([NAVIA_SELECTORS.fileUpload]) as HTMLInputElement;
  await delay(300);

  if (claim.invoiceDataUrl) {
    const file = dataUrlToFile(claim.invoiceDataUrl, "amazon-invoice.jpg");
    injectFile(fileInputEl, file);
    console.log("[FSA:navia:filler] Invoice file injected");
    await delay(500);
  } else {
    console.log("[FSA:navia:filler] No invoice dataUrl — skipping file upload");
  }

  // Click Next to go to Step 2
  console.log("[FSA:navia:filler] Clicking wizard Next button...");
  clickButton(NAVIA_SELECTORS.wizardNext);
  await delay(600);

  // ── Step 2: Claim details ─────────────────────────────────────────────────
  console.log("[FSA:navia:filler] Waiting for claim detail fields (#fromDate)...");
  await waitForElement([NAVIA_SELECTORS.serviceStartDate]);
  await delay(300);

  // Service start date
  const startDateEl = document.querySelector<HTMLInputElement>(NAVIA_SELECTORS.serviceStartDate);
  if (startDateEl) {
    const dateStr = formatClaimDate(firstItem.serviceDate);
    setInputValue(startDateEl, dateStr);
    console.log("[FSA:navia:filler] Set serviceStartDate:", dateStr);
    await delay(200);
  } else {
    console.log("[FSA:navia:filler] #fromDate not found");
  }

  // Service end date (same as start for retail purchases)
  const endDateEl = document.querySelector<HTMLInputElement>(NAVIA_SELECTORS.serviceEndDate);
  if (endDateEl) {
    const dateStr = formatClaimDate(firstItem.serviceDate);
    setInputValue(endDateEl, dateStr);
    console.log("[FSA:navia:filler] Set serviceEndDate:", dateStr);
    await delay(200);
  } else {
    console.log("[FSA:navia:filler] #toDate not found");
  }

  // Provider name
  const providerEl = document.querySelector<HTMLInputElement>(NAVIA_SELECTORS.providerName);
  if (providerEl) {
    setInputValue(providerEl, "Amazon.com");
    console.log("[FSA:navia:filler] Set providerName: Amazon.com");
    await delay(200);
  } else {
    console.log("[FSA:navia:filler] #providerName not found");
  }

  // For whom — defaults to "Self"; most FSA claims are self-purchases
  const forWhomEl = document.querySelector<HTMLSelectElement | HTMLInputElement>(NAVIA_SELECTORS.forWhom);
  if (forWhomEl) {
    if (forWhomEl instanceof HTMLSelectElement) {
      await setSelectValueAngular(forWhomEl, "Self");
    } else {
      setInputValue(forWhomEl as HTMLInputElement, "Self");
    }
    console.log("[FSA:navia:filler] Set forWhom: Self");
    await delay(200);
  } else {
    console.log("[FSA:navia:filler] #forWhom not found");
  }

  // Amount
  const amountEl = document.querySelector<HTMLInputElement>(NAVIA_SELECTORS.amount);
  if (amountEl) {
    const dollars = (claim.totalAmount / 100).toFixed(2);
    setInputValue(amountEl, dollars);
    console.log("[FSA:navia:filler] Set amount:", dollars);
    await delay(200);
  } else {
    console.log("[FSA:navia:filler] Amount input not found");
  }

  // Comments / description (truncated to 200 chars)
  const commentsEl = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(NAVIA_SELECTORS.comments);
  if (commentsEl) {
    setInputValue(commentsEl, firstItem.description.slice(0, 200));
    console.log("[FSA:navia:filler] Set comments");
    await delay(200);
  } else {
    console.log("[FSA:navia:filler] #claimComment not found");
  }

  // Step 2 benefit select (select.zoom-select) — may be a second benefit/type field
  const benefitEl = document.querySelector<HTMLSelectElement>(NAVIA_SELECTORS.benefitSelect);
  if (benefitEl) {
    await setSelectValueAngular(benefitEl, "FSA");
    await delay(200);
  } else {
    console.log("[FSA:navia:filler] select.zoom-select not found on Step 2");
  }

  // ── Step 2 done: click "I'm finished" ─────────────────────────────────────
  console.log("[FSA:navia:filler] Clicking wizardConfirm (#modal-wizard-confirm-btn)...");
  clickButton(NAVIA_SELECTORS.wizardConfirm);
  await delay(600);

  // ── Back on main page: check "Agree to Terms" ────────────────────────────
  try {
    await waitForElement([NAVIA_SELECTORS.agreeToTerms], 5000);
    const termsEl = document.querySelector<HTMLInputElement>(NAVIA_SELECTORS.agreeToTerms);
    if (termsEl && !termsEl.checked) {
      termsEl.click();
      console.log("[FSA:navia:filler] Checked agreeToTerms");
    } else if (termsEl?.checked) {
      console.log("[FSA:navia:filler] agreeToTerms already checked");
    }
  } catch {
    console.log("[FSA:navia:filler] agreeToTerms not found — skipping");
  }

  console.log("[FSA:navia:filler] Form fill complete for:", claim.id, "— ready for user review");
}

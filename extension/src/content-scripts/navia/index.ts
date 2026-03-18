/**
 * Navia Benefits content script entry point.
 * Listens for FILL_CLAIM messages and auto-fills the claim form.
 */

import type { SWToNaviaMessage } from "@/types";
import { logger } from "@/lib/logger";
import { fillClaimForm } from "./form-filler";
import { observeNavigation } from "./form-observer";

logger.log("Navia content script loaded on:", window.location.href);

// ── DOM discovery: log all form fields so we can identify real selectors ──────
function discoverFormFields(): void {
  const inputs = Array.from(document.querySelectorAll("input, select, textarea, button"));
  if (inputs.length === 0) {
    logger.log("[FSA:navia:discover] No form fields found yet (page may still be loading)");
    return;
  }
  logger.log(`[FSA:navia:discover] Found ${inputs.length} interactive elements:`);
  inputs.forEach((el, i) => {
    const e = el as HTMLInputElement;
    logger.log(
      `  [${i}] <${el.tagName.toLowerCase()}> ` +
      `type=${e.type ?? "—"} ` +
      `name="${e.name ?? ""}" ` +
      `id="${e.id ?? ""}" ` +
      `placeholder="${e.placeholder ?? ""}" ` +
      `class="${el.className.slice(0, 60)}"` +
      (el.tagName === "BUTTON" ? ` text="${el.textContent?.trim().slice(0, 40)}"` : "")
    );
  });
}

// Run discovery on load and after SPA navigations
setTimeout(discoverFormFields, 1500);

// Observe SPA navigation so we can re-attach listeners after page transitions
observeNavigation((url) => {
  logger.log("Navia SPA navigated to:", url);
  setTimeout(discoverFormFields, 1500);
});

chrome.runtime.onMessage.addListener(
  (message: SWToNaviaMessage, _sender, sendResponse) => {
    void handleMessage(message).then(sendResponse).catch((err: unknown) => {
      logger.error("Navia CS error:", err);
      sendResponse({ error: String(err) });
    });
    return true; // async
  }
);

async function handleMessage(message: SWToNaviaMessage): Promise<unknown> {
  switch (message.type) {
    case "FILL_CLAIM": {
      const { claim } = message;

      // Always dump DOM at fill time so we see current form state
      logger.log("[FSA:navia:discover] === DOM at fill time ===");
      discoverFormFields();

      try {
        await fillClaimForm(claim);

        // Notify SW that form is filled and ready for user review
        await chrome.runtime.sendMessage({
          type: "FILL_CLAIM_READY",
          claimId: claim.id,
        });

        // Listen for form submission to notify SW when done
        const submitBtn = document.querySelector("button[type='submit'], input[type='submit']");
        if (submitBtn) {
          const onSubmit = async () => {
            submitBtn.removeEventListener("click", onSubmit as EventListener);
            await chrome.runtime.sendMessage({
              type: "FILL_CLAIM_SUBMITTED",
              claimId: claim.id,
            });
          };
          submitBtn.addEventListener("click", onSubmit as EventListener, { once: true });
        }
      } catch (err) {
        await chrome.runtime.sendMessage({
          type: "FILL_CLAIM_ERROR",
          claimId: claim.id,
          message: String(err),
        });
      }

      return { ok: true };
    }

    default:
      return { error: "Unknown message" };
  }
}

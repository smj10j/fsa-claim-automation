/**
 * Navia Benefits content script entry point.
 * Listens for FILL_CLAIM messages and auto-fills the claim form.
 */

import type { SWToNaviaMessage } from "@/types";
import { logger } from "@/lib/logger";
import { fillClaimForm } from "./form-filler";
import { observeNavigation } from "./form-observer";

logger.log("Navia content script loaded on:", window.location.href);

// Observe SPA navigation so we can re-attach listeners after page transitions
observeNavigation((url) => {
  logger.log("Navia SPA navigated to:", url);
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

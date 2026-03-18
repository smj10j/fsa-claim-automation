import type { AppState } from "@/types";
import { readAppState, writeAppState, updateAppState } from "@/lib/storage";

export { readAppState, writeAppState, updateAppState };

/**
 * Broadcasts a state update to all open popups/extension pages.
 * The popup listens to chrome.storage.onChanged, but this provides
 * an additional direct notification channel.
 */
export async function broadcastStateUpdate(
  state: Partial<AppState>
): Promise<void> {
  try {
    await chrome.runtime.sendMessage({
      type: "STATE_UPDATED",
      state,
    });
  } catch {
    // Popup may not be open - that's fine
  }
}

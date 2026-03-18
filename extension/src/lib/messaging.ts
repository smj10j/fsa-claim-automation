import type {
  PopupToSWMessage,
  SWToPopupMessage,
  SWToAmazonMessage,
  SWToNaviaMessage,
} from "@/types";

/**
 * Send a message from the popup to the service worker.
 */
export async function sendToServiceWorker(
  message: PopupToSWMessage
): Promise<SWToPopupMessage | undefined> {
  return chrome.runtime.sendMessage(message);
}

/**
 * Send a message from the service worker to a specific tab (content script).
 */
export async function sendToTab(
  tabId: number,
  message: SWToAmazonMessage | SWToNaviaMessage
): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}

/**
 * Find a tab matching a URL pattern.
 * Returns the first matching tab, or undefined.
 */
export async function findTab(urlPattern: string): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({ url: urlPattern });
  return tabs[0];
}

/**
 * Open a URL in a new tab (or focus existing tab if already open).
 */
export async function openOrFocusTab(url: string): Promise<chrome.tabs.Tab> {
  const existing = await chrome.tabs.query({ url });
  if (existing.length > 0 && existing[0]?.id !== undefined) {
    const tab = existing[0];
    await chrome.tabs.update(tab.id!, { active: true });
    if (tab.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    return tab;
  }
  return chrome.tabs.create({ url });
}

/**
 * Wait for a tab to finish loading.
 */
export function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const listener = (
      id: number,
      _info: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (id === tabId && tab.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

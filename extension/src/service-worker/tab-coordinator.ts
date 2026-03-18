import { openOrFocusTab, waitForTabLoad } from "@/lib/messaging";
import { logger } from "@/lib/logger";

const NAVIA_PORTAL_URL = "https://app.naviabenefits.com/";

function amazonOrderHistoryUrl(year?: number): string {
  const base = "https://www.amazon.com/your-orders/orders";
  return year ? `${base}?timeFilter=year-${year}` : base;
}

/**
 * Opens (or navigates) the Amazon order history page filtered to the given year.
 * Always navigates to the year-filtered URL — this forces a fresh content script
 * load so it reads scanning_amazon from storage and triggers the scan immediately.
 * Returns the tab ID once the page is loaded.
 */
export async function openAmazonOrderHistory(year?: number): Promise<number> {
  const url = amazonOrderHistoryUrl(year);
  logger.log("Opening Amazon order history:", url);

  // Find any existing Amazon orders tab (regardless of current URL/filters)
  const existing = await chrome.tabs.query({ url: "https://www.amazon.com/your-orders/*" });
  if (existing.length > 0 && existing[0]?.id !== undefined) {
    const tabId = existing[0].id!;
    logger.log("Navigating existing Amazon tab to:", url);
    await chrome.tabs.update(tabId, { url, active: true });
    if (existing[0].windowId !== undefined) {
      await chrome.windows.update(existing[0].windowId, { focused: true });
    }
    await waitForTabLoad(tabId);
    logger.log("Amazon tab ready:", tabId);
    return tabId;
  }

  const tab = await chrome.tabs.create({ url });
  const tabId = tab.id;
  if (!tabId) throw new Error("Failed to open Amazon tab");
  await waitForTabLoad(tabId);
  logger.log("Amazon tab ready:", tabId);
  return tabId;
}

/**
 * Opens or focuses the Navia Benefits portal.
 * Returns the tab ID once the page is loaded.
 */
export async function openNaviaPortal(): Promise<number> {
  logger.log("Opening Navia portal...");
  const tab = await openOrFocusTab(NAVIA_PORTAL_URL);
  const tabId = tab.id;
  if (!tabId) throw new Error("Failed to open Navia tab");

  if (tab.status !== "complete") {
    await waitForTabLoad(tabId);
  }
  logger.log("Navia tab ready:", tabId);
  return tabId;
}

/**
 * Navigates an existing tab to a new URL and waits for it to load.
 */
export async function navigateTab(tabId: number, url: string): Promise<void> {
  await chrome.tabs.update(tabId, { url });
  await waitForTabLoad(tabId);
}

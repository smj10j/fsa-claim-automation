import { openOrFocusTab, waitForTabLoad } from "@/lib/messaging";
import { logger } from "@/lib/logger";

const AMAZON_ORDER_HISTORY_URL = "https://www.amazon.com/your-orders/orders";
const NAVIA_PORTAL_URL = "https://app.naviabenefits.com/";

/**
 * Opens or focuses the Amazon order history page.
 * Returns the tab ID once the page is loaded.
 */
export async function openAmazonOrderHistory(): Promise<number> {
  logger.log("Opening Amazon order history...");
  const tab = await openOrFocusTab(AMAZON_ORDER_HISTORY_URL);
  const tabId = tab.id;
  if (!tabId) throw new Error("Failed to open Amazon tab");

  if (tab.status !== "complete") {
    await waitForTabLoad(tabId);
  }
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

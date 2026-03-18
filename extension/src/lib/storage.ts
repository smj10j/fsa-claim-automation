import type { AppState } from "@/types";
import { getBenefitYear } from "./benefit-year";

const APP_STATE_KEY = "appState";
const INVOICE_KEY_PREFIX = "invoice:";

/**
 * Default initial app state.
 */
export function getDefaultAppState(): AppState {
  return {
    currentStep: "idle",
    benefitYear: getBenefitYear(),
    orders: [],
    selectedOrderIds: [],
    claims: [],
    lastError: undefined,
    lastScanAt: undefined,
  };
}

/**
 * Reads the full AppState from chrome.storage.local.
 * Returns default state if none exists yet.
 */
export async function readAppState(): Promise<AppState> {
  const result = await chrome.storage.local.get(APP_STATE_KEY);
  if (!result[APP_STATE_KEY]) {
    return getDefaultAppState();
  }
  return result[APP_STATE_KEY] as AppState;
}

/**
 * Writes the full AppState to chrome.storage.local.
 */
export async function writeAppState(state: AppState): Promise<void> {
  await chrome.storage.local.set({ [APP_STATE_KEY]: state });
}

/**
 * Merges a partial state update into the stored AppState.
 */
export async function updateAppState(
  update: Partial<AppState>
): Promise<AppState> {
  const current = await readAppState();
  const next = { ...current, ...update };
  await writeAppState(next);
  return next;
}

/**
 * Reads an invoice data URL from storage.
 * Returns undefined if not found.
 */
export async function readInvoice(orderId: string): Promise<string | undefined> {
  const key = `${INVOICE_KEY_PREFIX}${orderId}`;
  const result = await chrome.storage.local.get(key);
  return result[key] as string | undefined;
}

/**
 * Writes an invoice data URL to storage.
 */
export async function writeInvoice(
  orderId: string,
  dataUrl: string
): Promise<void> {
  const key = `${INVOICE_KEY_PREFIX}${orderId}`;
  await chrome.storage.local.set({ [key]: dataUrl });
}

/**
 * Removes all invoice data from storage.
 */
export async function clearInvoices(orderIds: string[]): Promise<void> {
  const keys = orderIds.map((id) => `${INVOICE_KEY_PREFIX}${id}`);
  await chrome.storage.local.remove(keys);
}

/**
 * Clears all extension data (full reset).
 */
export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}

/**
 * Returns current storage usage in bytes.
 */
export async function getStorageUsage(): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage.local.getBytesInUse(null, resolve);
  });
}

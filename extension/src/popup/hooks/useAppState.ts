import { useState, useEffect, useCallback } from "react";
import type { AppState } from "@/types";
import { sendToServiceWorker } from "@/lib/messaging";
import { getDefaultAppState } from "@/lib/storage";

/**
 * React hook for reading and reacting to AppState changes.
 *
 * - Fetches initial state from the service worker on mount
 * - Listens to chrome.storage.onChanged for live updates
 * - Returns state and a sendMessage helper
 */
export function useAppState() {
  const [state, setState] = useState<AppState>(getDefaultAppState());
  const [loading, setLoading] = useState(true);

  // Fetch initial state
  useEffect(() => {
    void sendToServiceWorker({ type: "GET_STATE" }).then((response) => {
      if (response && "state" in response) {
        setState(response.state);
      }
      setLoading(false);
    });
  }, []);

  // Subscribe to storage changes for live updates
  useEffect(() => {
    const handler = (
      changes: Record<string, chrome.storage.StorageChange>
    ) => {
      if ("appState" in changes && changes["appState"]?.newValue) {
        setState(changes["appState"].newValue as AppState);
      }
    };

    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  const sendMessage = useCallback(
    (message: Parameters<typeof sendToServiceWorker>[0]) =>
      sendToServiceWorker(message),
    []
  );

  return { state, loading, sendMessage };
}

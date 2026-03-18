import { logger } from "@/lib/logger";

type NavigationCallback = (url: string) => void;

/**
 * Observes SPA navigation on the Navia portal.
 * Calls callback when the URL changes (for React Router / hash-based navigation).
 */
export function observeNavigation(callback: NavigationCallback): () => void {
  let lastUrl = window.location.href;

  // Watch for pushState/replaceState
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args) {
    originalPushState(...args);
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      callback(lastUrl);
    }
  };

  history.replaceState = function (...args) {
    originalReplaceState(...args);
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      callback(lastUrl);
    }
  };

  // Watch for popstate (back/forward buttons)
  const onPopState = () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      callback(lastUrl);
    }
  };
  window.addEventListener("popstate", onPopState);

  logger.log("Navigation observer active");

  // Return cleanup function
  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", onPopState);
  };
}

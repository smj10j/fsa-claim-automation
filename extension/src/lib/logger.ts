/**
 * Development logger. Logs are stripped in production builds.
 * Use this instead of console.log to avoid leaving debug output in production.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log("[FSA]", ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn("[FSA]", ...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors, even in production (no sensitive data in errors)
    console.error("[FSA]", ...args);
  },
  group: (label: string) => {
    if (isDev) console.group(`[FSA] ${label}`);
  },
  groupEnd: () => {
    if (isDev) console.groupEnd();
  },
};

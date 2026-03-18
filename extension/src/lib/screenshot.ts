/**
 * Invoice screenshot capture utilities.
 *
 * Uses html2canvas to render a specific DOM element to a JPEG data URL.
 * Falls back to chrome.tabs.captureVisibleTab if html2canvas fails.
 */

/**
 * Captures a DOM element as a JPEG data URL.
 * Should be called from content scripts only.
 *
 * @param element - The DOM element to capture
 * @param quality - JPEG quality 0-1 (default 0.85)
 * @returns base64 JPEG data URL
 */
export async function captureElement(
  element: HTMLElement,
  quality = 0.85
): Promise<string> {
  const { default: html2canvas } = await import("html2canvas");

  const canvas = await html2canvas(element, {
    scale: 0.75, // Reduce size ~44% to save storage
    useCORS: true,
    logging: false,
    allowTaint: false,
    backgroundColor: "#ffffff",
  });

  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * Converts a base64 data URL to a File object.
 * Used for injecting into file input elements on the Navia form.
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header?.match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";

  const binary = atob(base64 ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mime });
}

/**
 * Returns the approximate size of a data URL in kilobytes.
 */
export function getDataUrlSizeKB(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.round((base64.length * 0.75) / 1024);
}

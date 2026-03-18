/**
 * Claim export utilities.
 *
 * Generates a human-readable markdown summary of FSA claims and downloads
 * the package (markdown + invoice images) to the user's Downloads folder via
 * the chrome.downloads API.
 *
 * Output structure:
 *   Downloads/<folderName>/
 *     claim-summary.md
 *     invoice-<orderId>.png   (one per claim)
 */

import type { Claim } from "@/types";
import type { BenefitYear } from "@/types";
import { formatClaimDate } from "./benefit-year";

/**
 * Returns today's date as "yyyy-mm-dd" for use as the default folder name.
 */
export function defaultExportFolderName(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Generates the markdown claim summary for all claims in the export package.
 *
 * Each claim section contains all the information needed to manually fill in
 * the Navia Benefits claim submission form.
 */
export function generateClaimMarkdown(
  claims: Claim[],
  benefitYear: BenefitYear,
  folderName: string
): string {
  const totalAmount = claims.reduce((s, c) => s + c.totalAmount, 0);
  const generatedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines: string[] = [
    `# FSA Claim Package`,
    ``,
    `**Generated:** ${generatedAt}`,
    `**Benefit Year:** ${benefitYear.label} (Jan 1 – Dec 31, ${benefitYear.year})`,
    `**Claims:** ${claims.length}`,
    `**Total Amount:** ${formatDollars(totalAmount)}`,
    `**Folder:** ${folderName}`,
    ``,
    `---`,
    ``,
    `## How to Submit`,
    ``,
    `1. Log in to [Navia Benefits](https://app.naviabenefits.com)`,
    `2. Navigate to **Submit Claim**`,
    `3. For each claim below: click **Add item to claim**, fill in the fields,`,
    `   attach the corresponding invoice PNG, then click Next / I'm Finished`,
    `4. Check **Agree to Terms** and click **Send claim to Navia**`,
    ``,
    `---`,
    ``,
  ];

  claims.forEach((claim, i) => {
    const item = claim.items[0];
    if (!item) return;

    const invoiceFile = `invoice-${claim.sourceOrderId}.png`;
    const serviceDate = formatClaimDate(new Date(item.serviceDate));

    lines.push(`## Claim ${i + 1} of ${claims.length}`);
    lines.push(``);
    lines.push(`| Field | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| **Benefit** | Health Care FSA |`);
    lines.push(`| **Plan Year** | 01/01/${benefitYear.year} - 12/31/${benefitYear.year} |`);
    lines.push(`| **Provider Name** | Amazon.com |`);
    lines.push(`| **For Whom** | Self |`);
    lines.push(`| **Service Start Date** | ${serviceDate} |`);
    lines.push(`| **Service End Date** | ${serviceDate} |`);
    lines.push(`| **Amount** | ${formatDollars(claim.totalAmount)} |`);
    lines.push(`| **Expense Type** | ${item.expenseType} |`);
    lines.push(`| **Amazon Order #** | ${claim.sourceOrderId} |`);
    lines.push(`| **Invoice File** | \`${invoiceFile}\` |`);
    lines.push(``);

    if (claim.items.length > 0) {
      lines.push(`### Items`);
      lines.push(``);
      for (const ci of claim.items) {
        lines.push(`- ${ci.description} — ${formatDollars(ci.amount)}`);
      }
      lines.push(``);
    }

    lines.push(`---`);
    lines.push(``);
  });

  return lines.join("\n");
}

/**
 * Downloads the full claim export package to the user's Downloads folder.
 *
 * Files saved:
 *   <folderName>/claim-summary.md   — human-readable claim details
 *   <folderName>/invoice-<id>.png   — invoice screenshot per claim
 */
export async function downloadClaimPackage(
  claims: Claim[],
  benefitYear: BenefitYear,
  folderName: string
): Promise<void> {
  console.log(
    `[FSA:sw] Downloading claim package to Downloads/${folderName}/`
  );

  // 1. Markdown summary
  const markdown = generateClaimMarkdown(claims, benefitYear, folderName);
  const mdDataUrl =
    "data:text/markdown;charset=utf-8," + encodeURIComponent(markdown);

  await chrome.downloads.download({
    url: mdDataUrl,
    filename: `${folderName}/claim-summary.md`,
    conflictAction: "overwrite",
    saveAs: false,
  });

  // 2. Invoice images — one PNG per claim
  for (const claim of claims) {
    if (!claim.invoiceDataUrl) continue;

    // Detect format from data URL prefix; default to png
    const ext = claim.invoiceDataUrl.startsWith("data:image/jpeg") ? "jpg" : "png";
    const filename = `${folderName}/invoice-${claim.sourceOrderId}.${ext}`;

    await chrome.downloads.download({
      url: claim.invoiceDataUrl,
      filename,
      conflictAction: "overwrite",
      saveAs: false,
    });

    console.log(`[FSA:sw] Downloaded invoice: ${filename}`);
  }

  console.log(
    `[FSA:sw] Claim package download complete: ${claims.length} invoices + claim-summary.md`
  );
}

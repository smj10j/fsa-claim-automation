import type { BenefitYear } from "@/types";

/**
 * Returns the current FSA benefit year.
 * Standard FSA benefit year is Jan 1 - Dec 31 of the calendar year.
 *
 * @param overrideYear - Optional year override (defaults to current year)
 */
export function getBenefitYear(overrideYear?: number): BenefitYear {
  const year = overrideYear ?? new Date().getFullYear();
  return {
    year,
    start: new Date(year, 0, 1), // Jan 1
    end: new Date(year, 11, 31, 23, 59, 59), // Dec 31
    label: String(year),
  };
}

/**
 * Checks if a given date falls within a benefit year.
 */
export function isWithinBenefitYear(date: Date, year: BenefitYear): boolean {
  return date >= year.start && date <= year.end;
}

/**
 * Parses an Amazon order date string to a Date object.
 * Amazon uses formats like "January 15, 2025" or "Jan 15, 2025"
 */
export function parseAmazonDate(dateStr: string): Date | null {
  // Try standard date parsing first
  const parsed = new Date(dateStr.trim());
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  return null;
}

/**
 * Formats a date as a string suitable for FSA claim service date fields.
 * Returns MM/DD/YYYY format.
 */
export function formatClaimDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Formats a date in ISO format (YYYY-MM-DD) for HTML date inputs.
 */
export function formatISODate(date: Date): string {
  return date.toISOString().substring(0, 10);
}

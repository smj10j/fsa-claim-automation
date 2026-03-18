import { describe, it, expect } from "vitest";
import {
  getBenefitYear,
  isWithinBenefitYear,
  parseAmazonDate,
  formatClaimDate,
  formatISODate,
} from "@/lib/benefit-year";

describe("getBenefitYear", () => {
  it("returns the current year by default", () => {
    const year = getBenefitYear();
    expect(year.year).toBe(new Date().getFullYear());
  });

  it("returns the specified year when overridden", () => {
    const year = getBenefitYear(2025);
    expect(year.year).toBe(2025);
    expect(year.label).toBe("2025");
  });

  it("sets start to Jan 1", () => {
    const year = getBenefitYear(2025);
    expect(year.start.getMonth()).toBe(0); // January = 0
    expect(year.start.getDate()).toBe(1);
  });

  it("sets end to Dec 31", () => {
    const year = getBenefitYear(2025);
    expect(year.end.getMonth()).toBe(11); // December = 11
    expect(year.end.getDate()).toBe(31);
  });
});

describe("isWithinBenefitYear", () => {
  const year2025 = getBenefitYear(2025);

  it("returns true for a date within the year", () => {
    expect(isWithinBenefitYear(new Date("2025-06-15"), year2025)).toBe(true);
  });

  it("returns true for Jan 1", () => {
    expect(isWithinBenefitYear(new Date(2025, 0, 1), year2025)).toBe(true);
  });

  it("returns true for Dec 31", () => {
    expect(isWithinBenefitYear(new Date(2025, 11, 31), year2025)).toBe(true);
  });

  it("returns false for a date in the previous year", () => {
    expect(isWithinBenefitYear(new Date(2024, 11, 31), year2025)).toBe(false);
  });

  it("returns false for a date in the next year", () => {
    expect(isWithinBenefitYear(new Date(2026, 0, 1), year2025)).toBe(false);
  });
});

describe("parseAmazonDate", () => {
  it("parses full month name format", () => {
    const date = parseAmazonDate("January 15, 2025");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2025);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(15);
  });

  it("parses abbreviated month format", () => {
    const date = parseAmazonDate("Mar 8, 2025");
    expect(date).not.toBeNull();
    expect(date?.getMonth()).toBe(2);
  });

  it("returns null for invalid date strings", () => {
    const date = parseAmazonDate("not a date");
    expect(date).toBeNull();
  });
});

describe("formatClaimDate", () => {
  it("formats a date as MM/DD/YYYY", () => {
    const date = new Date(2025, 0, 15); // Jan 15, 2025
    expect(formatClaimDate(date)).toBe("01/15/2025");
  });

  it("zero-pads single-digit months and days", () => {
    const date = new Date(2025, 2, 8); // Mar 8, 2025
    expect(formatClaimDate(date)).toBe("03/08/2025");
  });
});

describe("formatISODate", () => {
  it("formats a date as YYYY-MM-DD", () => {
    const date = new Date("2025-01-15T12:00:00Z");
    expect(formatISODate(date)).toBe("2025-01-15");
  });
});

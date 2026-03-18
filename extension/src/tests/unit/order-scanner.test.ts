import { describe, it, expect } from "vitest";
import { parsePriceToCents } from "@/content-scripts/amazon/order-scanner";

describe("parsePriceToCents", () => {
  it("parses a dollar amount with sign", () => {
    expect(parsePriceToCents("$18.99")).toBe(1899);
  });

  it("parses a dollar amount without sign", () => {
    expect(parsePriceToCents("18.99")).toBe(1899);
  });

  it("parses a whole dollar amount", () => {
    expect(parsePriceToCents("$52.00")).toBe(5200);
  });

  it("handles amounts with commas", () => {
    expect(parsePriceToCents("$1,234.56")).toBe(123456);
  });

  it("returns 0 for empty string", () => {
    expect(parsePriceToCents("")).toBe(0);
  });

  it("returns 0 for non-numeric string", () => {
    expect(parsePriceToCents("N/A")).toBe(0);
  });
});

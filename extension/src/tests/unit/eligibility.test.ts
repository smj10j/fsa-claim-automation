import { describe, it, expect } from "vitest";
import { checkEligibility, getCategoryLabel } from "@/lib/eligibility";

describe("checkEligibility", () => {
  it("identifies OTC pain relievers as eligible", () => {
    const result = checkEligibility("Advil Ibuprofen Tablets 200mg 100ct");
    expect(result.isEligible).toBe(true);
    expect(result.category).toBe("otc_medicine");
  });

  it("identifies bandages as first aid eligible", () => {
    const result = checkEligibility("Band-Aid Brand Flexible Fabric Bandages 100ct");
    expect(result.isEligible).toBe(true);
    expect(result.category).toBe("first_aid");
  });

  it("identifies blood pressure monitor as medical equipment", () => {
    const result = checkEligibility(
      "Omron Silver Blood Pressure Monitor Upper Arm"
    );
    expect(result.isEligible).toBe(true);
    expect(result.category).toBe("medical_equipment");
  });

  it("identifies contact solution as vision eligible", () => {
    const result = checkEligibility(
      "OPTI-FREE Replenish Multi-Purpose Contact Lens Solution"
    );
    expect(result.isEligible).toBe(true);
    expect(result.category).toBe("vision");
  });

  it("identifies menstrual products as feminine hygiene eligible", () => {
    const result = checkEligibility("Tampax Pearl Tampons Regular Absorbency 50ct");
    expect(result.isEligible).toBe(true);
    expect(result.category).toBe("feminine_hygiene");
  });

  it("identifies electric toothbrush as dental eligible", () => {
    const result = checkEligibility("Oral-B Pro 1000 Electric Toothbrush");
    expect(result.isEligible).toBe(true);
    expect(result.category).toBe("dental");
  });

  it("returns not eligible for regular food items", () => {
    const result = checkEligibility("Kirkland Organic Whole Milk 3 Pack");
    expect(result.isEligible).toBe(false);
  });

  it("returns not eligible for electronics", () => {
    const result = checkEligibility(
      "Sony WH-1000XM5 Wireless Noise Canceling Headphones"
    );
    expect(result.isEligible).toBe(false);
  });

  it("returns not eligible for clothing", () => {
    const result = checkEligibility("Hanes Men's T-Shirt 6 Pack");
    expect(result.isEligible).toBe(false);
  });

  it("is case insensitive", () => {
    const result = checkEligibility("TYLENOL EXTRA STRENGTH 500MG 100CT");
    expect(result.isEligible).toBe(true);
  });

  it("includes the matched keyword in the reason", () => {
    const result = checkEligibility("Zyrtec Allergy 10mg Tablets 90ct");
    expect(result.reason).toContain("zyrtec");
  });
});

describe("getCategoryLabel", () => {
  it("returns human-readable label for otc_medicine", () => {
    expect(getCategoryLabel("otc_medicine")).toBe("OTC Medicine");
  });

  it("returns human-readable label for first_aid", () => {
    expect(getCategoryLabel("first_aid")).toBe("First Aid");
  });
});

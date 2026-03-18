import { describe, it, expect } from "vitest";
import { checkEligibility } from "@/lib/eligibility";

describe("checkEligibility", () => {
  it("identifies OTC pain relievers as covered", () => {
    const result = checkEligibility("Advil Ibuprofen Tablets 200mg 100ct");
    expect(result.isEligible).toBe(true);
    expect(result.naviaExpense?.name).toBe("Pain relievers");
    expect(result.naviaExpense?.status).toBe("covered");
  });

  it("identifies bandages as covered", () => {
    const result = checkEligibility("Band-Aid Brand Flexible Fabric Bandages 100ct");
    expect(result.isEligible).toBe(true);
    expect(result.naviaExpense?.name).toBe("Bandages/gauze");
    expect(result.naviaExpense?.status).toBe("covered");
  });

  it("identifies blood pressure monitor as covered", () => {
    const result = checkEligibility("Omron Silver Blood Pressure Monitor Upper Arm");
    expect(result.isEligible).toBe(true);
    expect(result.naviaExpense?.name).toBe("Blood pressure monitor");
  });

  it("identifies contact solution as covered", () => {
    const result = checkEligibility("OPTI-FREE Replenish Multi-Purpose Contact Lens Solution");
    expect(result.isEligible).toBe(true);
    expect(result.naviaExpense?.name).toBe("Contacts & solutions");
  });

  it("identifies menstrual products as covered", () => {
    const result = checkEligibility("Tampax Pearl Tampons Regular Absorbency 50ct");
    expect(result.isEligible).toBe(true);
    expect(result.naviaExpense?.name).toBe("Menstrual care products");
  });

  it("identifies sunscreen as covered", () => {
    const result = checkEligibility("Neutrogena Ultra Sheer Sunscreen SPF 50 3oz");
    expect(result.isEligible).toBe(true);
    expect(result.naviaExpense?.name).toBe("Sunscreen SPF 15 or more");
  });

  it("identifies sleep aids as covered", () => {
    const result = checkEligibility("ZzzQuil Nighttime Sleep Aid LiquiCaps 48ct");
    expect(result.isEligible).toBe(true);
    expect(result.naviaExpense?.name).toBe("Sleep aids & sedatives");
  });

  it("identifies nicotine patches as covered", () => {
    const result = checkEligibility("NicoDerm CQ Nicotine Patch Step 1 21mg 14ct");
    expect(result.isEligible).toBe(true);
    expect(result.naviaExpense?.name).toBe("Smoking cessation programs & products");
  });

  it("identifies acne treatment as covered (OTC eligible per Navia)", () => {
    const result = checkEligibility("Differin Adapalene Gel 0.1% Acne Treatment");
    expect(result.isEligible).toBe(true);
    expect(result.naviaExpense?.status).toBe("covered");
    expect(result.naviaExpense?.name).toBe("Acne treatment");
  });

  it("identifies electric toothbrush as NOT eligible (per Navia)", () => {
    const result = checkEligibility("Oral-B Pro 1000 Electric Toothbrush");
    expect(result.isEligible).toBe(false);
  });

  it("identifies water flosser as eligible with LMN", () => {
    const result = checkEligibility("Waterpik Aquarius Water Flosser");
    expect(result.isEligible).toBe(true);
    expect(result.naviaExpense?.status).toBe("lmn");
  });

  it("returns not eligible for regular food items", () => {
    const result = checkEligibility("Kirkland Organic Whole Milk 3 Pack");
    expect(result.isEligible).toBe(false);
  });

  it("returns not eligible for electronics", () => {
    const result = checkEligibility("Sony WH-1000XM5 Wireless Noise Canceling Headphones");
    expect(result.isEligible).toBe(false);
  });

  it("is case insensitive", () => {
    const result = checkEligibility("TYLENOL EXTRA STRENGTH 500MG 100CT");
    expect(result.isEligible).toBe(true);
  });

  it("includes matched keyword and Navia expense name in reason", () => {
    const result = checkEligibility("Zyrtec Allergy 10mg Tablets 90ct");
    expect(result.reason).toContain("zyrtec");
    expect(result.reason).toContain("Allergy & sinus medication");
  });
});

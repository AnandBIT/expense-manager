import { describe, expect, it } from "vitest";
import { amountToInput, formatMoney, parseAmount, parsePercent } from "../../src/lib/money";

describe("parseAmount", () => {
  it("reads rupees into paise", () => {
    expect(parseAmount("100", "INR")).toBe(10000);
    expect(parseAmount("1,250.5", "INR")).toBe(125050);
    expect(parseAmount("0.75", "INR")).toBe(75);
    expect(parseAmount(" 300 ", "INR")).toBe(30000);
  });

  it("rejects anything that isn't a plain amount", () => {
    for (const bad of ["", "abc", "-5", "12.345", "1e5", "5.", ".5"]) {
      expect(parseAmount(bad, "INR")).toBeNull();
    }
  });

  it("allows no decimals for currencies without minor units", () => {
    expect(parseAmount("500", "JPY")).toBe(500);
    expect(parseAmount("5.5", "JPY")).toBeNull();
  });
});

describe("parsePercent", () => {
  it("reads percentages into basis points", () => {
    expect(parsePercent("33.33")).toBe(3333);
    expect(parsePercent("100")).toBe(10000);
    expect(parsePercent("0.5")).toBe(50);
  });

  it("rejects more than 100% or more than 2 decimals", () => {
    expect(parsePercent("100.01")).toBeNull();
    expect(parsePercent("1.234")).toBeNull();
    expect(parsePercent("-1")).toBeNull();
  });
});

describe("formatting", () => {
  it("hides .00 on whole amounts but keeps real paise", () => {
    expect(formatMoney(10000, "INR")).toMatch(/100$/);
    expect(formatMoney(12550, "INR")).toMatch(/125\.50$/);
  });

  it("round-trips amounts through the edit form", () => {
    expect(parseAmount(amountToInput(12550, "INR"), "INR")).toBe(12550);
    expect(parseAmount(amountToInput(7, "INR"), "INR")).toBe(7);
  });
});

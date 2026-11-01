import { describe, expect, it } from "vitest";
import { splitByPercentage, splitEqually, sum } from "../../src/lib/split";

describe("splitEqually", () => {
  it("splits ₹500 between 5 people as ₹100 each", () => {
    const shares = splitEqually(50000, ["a", "b", "c", "d", "e"]);
    expect(shares).toEqual({ a: 10000, b: 10000, c: 10000, d: 10000, e: 10000 });
  });

  it("gives leftover paise to the first people so the total stays exact", () => {
    const shares = splitEqually(10000, ["payer", "b", "c"]);
    expect(shares).toEqual({ payer: 3334, b: 3333, c: 3333 });
    expect(sum(Object.values(shares))).toBe(10000);
  });

  it("handles one person", () => {
    expect(splitEqually(999, ["a"])).toEqual({ a: 999 });
  });
});

describe("splitByPercentage", () => {
  it("splits ₹1000 as 40/20/20/20", () => {
    const shares = splitByPercentage(100000, { a: 4000, b: 2000, c: 2000, d: 2000 });
    expect(shares).toEqual({ a: 40000, b: 20000, c: 20000, d: 20000 });
  });

  it("rounds so the shares add up to exactly the amount", () => {
    const shares = splitByPercentage(100, { a: 3333, b: 3333, c: 3334 });
    expect(shares).toEqual({ a: 33, b: 33, c: 34 });
  });

  it("keeps the total exact for awkward amounts", () => {
    for (const amount of [1, 7, 99, 101, 12345, 99999]) {
      const shares = splitByPercentage(amount, { a: 3333, b: 3333, c: 3334 });
      expect(sum(Object.values(shares))).toBe(amount);
    }
  });

  it("gives 0 to someone at 0%", () => {
    expect(splitByPercentage(30000, { a: 10000, b: 0 })).toEqual({ a: 30000, b: 0 });
  });
});

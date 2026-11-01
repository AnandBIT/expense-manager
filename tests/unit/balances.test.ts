import { describe, expect, it } from "vitest";
import { balancesFor, debtsInExpense, isFullySettled } from "../../src/lib/balances";
import { splitEqually } from "../../src/lib/split";
import type { Expense } from "../../src/lib/types";

function expense(overrides: Partial<Expense> & Pick<Expense, "id" | "paidBy" | "shares">): Expense {
  return {
    description: overrides.id,
    amount: Object.values(overrides.shares).reduce((a, b) => a + b, 0),
    splitType: "equal",
    participantIds: Object.keys(overrides.shares),
    date: "2026-10-04",
    createdAt: null,
    updatedAt: null,
    paidMarks: {},
    settled: {},
    ...overrides,
  };
}

describe("one payer, five people, ₹500 split equally", () => {
  const dinner = expense({
    id: "dinner",
    paidBy: "A",
    shares: splitEqually(50000, ["A", "B", "C", "D", "E"]),
  });

  it("means B, C, D and E each owe A ₹100", () => {
    const debts = debtsInExpense(dinner);
    expect(debts.map((d) => [d.from, d.to, d.amount])).toEqual([
      ["B", "A", 10000],
      ["C", "A", 10000],
      ["D", "A", 10000],
      ["E", "A", 10000],
    ]);
  });

  it("shows B 'you have to pay ₹100 to A' and A 'B owes you ₹100'", () => {
    expect(balancesFor("B", [dinner])).toMatchObject([{ personId: "A", net: -10000 }]);
    expect(balancesFor("A", [dinner]).find((b) => b.personId === "B")?.net).toBe(10000);
  });

  it("keeps a debt open while it's pending verification", () => {
    const pending = { ...dinner, paidMarks: { B: null } };
    const [balance] = balancesFor("B", [pending]);
    expect(balance.net).toBe(-10000);
    expect(balance.debts[0].status).toBe("pending");
  });

  it("clears only B's ₹100 once A confirms receipt", () => {
    const confirmed = { ...dinner, paidMarks: { B: null }, settled: { B: null } };
    expect(balancesFor("B", [confirmed])).toEqual([]);
    expect(balancesFor("A", [confirmed]).map((b) => b.personId)).toEqual(["C", "D", "E"]);
    expect(isFullySettled(confirmed)).toBe(false);
  });

  it("is settled once every share is confirmed", () => {
    const all = { ...dinner, settled: { B: null, C: null, D: null, E: null } };
    expect(isFullySettled(all)).toBe(true);
  });
});

describe("netting between two people", () => {
  const dinner = expense({ id: "dinner", paidBy: "B", shares: { A: 8000, B: 8000 } });
  const cab = expense({ id: "cab", paidBy: "A", shares: { A: 3000, B: 3000 } });

  it("A owes B ₹80 and B owes A ₹30, so A has to pay ₹50", () => {
    const [balance] = balancesFor("A", [dinner, cab]);
    expect(balance).toMatchObject({ personId: "B", net: -5000 });
    expect(balance.debts).toHaveLength(2);
    expect(balancesFor("B", [dinner, cab])[0].net).toBe(5000);
  });

  it("doesn't involve people who weren't part of either expense", () => {
    expect(balancesFor("C", [dinner, cab])).toEqual([]);
  });
});

describe("an expense only the payer shares", () => {
  it("isn't shown as settled, since nobody owed anything", () => {
    const solo = expense({ id: "solo", paidBy: "A", shares: { A: 50000 } });
    expect(debtsInExpense(solo)).toEqual([]);
    expect(isFullySettled(solo)).toBe(false);
  });
});

describe("payer who isn't sharing the cost", () => {
  it("is owed the whole amount", () => {
    const gift = expense({ id: "gift", paidBy: "A", shares: { B: 15000, C: 15000 } });
    const balances = balancesFor("A", [gift]);
    expect(balances.map((b) => [b.personId, b.net])).toEqual([
      ["B", 15000],
      ["C", 15000],
    ]);
  });
});

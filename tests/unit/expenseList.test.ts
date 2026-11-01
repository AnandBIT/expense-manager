import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { expenseSections, sortExpenses } from "../../src/lib/expenseList";
import type { Expense } from "../../src/lib/types";

function expense(overrides: Partial<Expense> & Pick<Expense, "id">): Expense {
  return {
    description: overrides.id,
    amount: 1000,
    paidBy: "me",
    splitType: "equal",
    participantIds: ["me"],
    shares: { me: 1000 },
    date: "2026-10-04",
    createdAt: null,
    updatedAt: null,
    paidMarks: {},
    settled: {},
    ...overrides,
  };
}

const names: Record<string, string> = { me: "You", alice: "Alice", bob: "Bob" };
const nameOf = (uid: string) => names[uid];
const ids = (expenses: Expense[]) => expenses.map((e) => e.id);
const added = (n: number) => Timestamp.fromMillis(n);

const all = [
  expense({ id: "lunch", date: "2026-10-03", amount: 5000, paidBy: "alice", createdAt: added(1) }),
  expense({ id: "cab", date: "2026-10-04", amount: 800, paidBy: "bob", createdAt: added(2) }),
  expense({ id: "dinner", date: "2026-10-04", amount: 12000, paidBy: "me", createdAt: added(3) }),
  expense({ id: "coffee", date: "2026-10-04", amount: 2000, paidBy: "alice", createdAt: added(4) }),
  expense({ id: "snacks", date: "2026-10-02", amount: 900, paidBy: "bob", createdAt: added(0) }),
];

describe("sortExpenses", () => {
  it("sorts by date, newest day first, then by when it was added", () => {
    expect(ids(sortExpenses(all, "date", "me", nameOf))).toEqual([
      "coffee",
      "dinner",
      "cab",
      "lunch",
      "snacks",
    ]);
  });

  it("sorts by amount, highest first", () => {
    expect(ids(sortExpenses(all, "amount", "me", nameOf))).toEqual([
      "dinner",
      "lunch",
      "coffee",
      "snacks",
      "cab",
    ]);
  });

  it("sorts by who paid: you first, then by name, newest first for each person", () => {
    expect(ids(sortExpenses(all, "payer", "me", nameOf))).toEqual([
      "dinner",
      "coffee",
      "lunch",
      "cab",
      "snacks",
    ]);
  });

  it("leaves the original list alone", () => {
    sortExpenses(all, "amount", "me", nameOf);
    expect(ids(all)).toEqual(["lunch", "cab", "dinner", "coffee", "snacks"]);
  });
});

describe("expenseSections", () => {
  it("groups by day with each day's total, newest day first", () => {
    const sections = expenseSections(sortExpenses(all, "date", "me", nameOf), "date");
    expect(sections.map((s) => [s.key, ids(s.expenses), s.total])).toEqual([
      ["2026-10-04", ["coffee", "dinner", "cab"], 14800],
      ["2026-10-03", ["lunch"], 5000],
      ["2026-10-02", ["snacks"], 900],
    ]);
  });

  it("keeps days newest first when sorted by amount, biggest first inside each day", () => {
    const sections = expenseSections(sortExpenses(all, "amount", "me", nameOf), "amount");
    expect(sections.map((s) => [s.key, ids(s.expenses)])).toEqual([
      ["2026-10-04", ["dinner", "coffee", "cab"]],
      ["2026-10-03", ["lunch"]],
      ["2026-10-02", ["snacks"]],
    ]);
  });

  it("groups by who paid, in payer order, with what each person paid in total", () => {
    const sections = expenseSections(sortExpenses(all, "payer", "me", nameOf), "payer");
    expect(sections.map((s) => [s.key, ids(s.expenses), s.total])).toEqual([
      ["me", ["dinner"], 12000],
      ["alice", ["coffee", "lunch"], 7000],
      ["bob", ["cab", "snacks"], 1700],
    ]);
  });
});

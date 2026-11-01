import type { Expense } from "./types";

export type ExpenseSort = "date" | "amount" | "payer";

export const EXPENSE_SORTS: { value: ExpenseSort; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "amount", label: "Amount" },
  { value: "payer", label: "Paid by" },
];

// Newest first by the day it was spent, then by when it was added.
export function newestFirst(a: Expense, b: Expense): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity);
}

// Amount: highest first. Paid by: you first, then by name. Ties stay newest first.
export function sortExpenses(
  expenses: Expense[],
  sort: ExpenseSort,
  me: string,
  nameOf: (uid: string) => string,
): Expense[] {
  function compare(a: Expense, b: Expense): number {
    if (sort === "amount") return b.amount - a.amount;
    if (sort === "payer") {
      return (
        Number(b.paidBy === me) - Number(a.paidBy === me) ||
        nameOf(a.paidBy).localeCompare(nameOf(b.paidBy)) ||
        a.paidBy.localeCompare(b.paidBy)
      );
    }
    return 0;
  }
  return [...expenses].sort((a, b) => compare(a, b) || newestFirst(a, b));
}

export type ExpenseSection = { key: string; expenses: Expense[]; total: number };

// Sections for the accordion view: one per payer for the payer sort, otherwise
// one per day (newest day first). Expenses keep their sorted order inside.
export function expenseSections(sorted: Expense[], sort: ExpenseSort): ExpenseSection[] {
  const byKey = new Map<string, ExpenseSection>();
  for (const expense of sorted) {
    const key = sort === "payer" ? expense.paidBy : expense.date;
    const section = byKey.get(key) ?? { key, expenses: [], total: 0 };
    section.expenses.push(expense);
    section.total += expense.amount;
    byKey.set(key, section);
  }
  const sections = [...byKey.values()];
  return sort === "payer" ? sections : sections.sort((a, b) => (a.key < b.key ? 1 : -1));
}

import type { Expense } from "./types";

export type DebtStatus = "unpaid" | "pending" | "settled";

// One person's share of one expense, owed to whoever paid for it.
export type Debt = {
  expenseId: string;
  description: string;
  date: string;
  from: string;
  to: string;
  amount: number;
  status: DebtStatus;
};

export function debtStatus(expense: Expense, debtorId: string): DebtStatus {
  if (debtorId in expense.settled) return "settled";
  if (debtorId in expense.paidMarks) return "pending";
  return "unpaid";
}

export function debtsInExpense(expense: Expense): Debt[] {
  return expense.participantIds
    .filter((id) => id !== expense.paidBy && expense.shares[id] > 0)
    .map((id) => ({
      expenseId: expense.id,
      description: expense.description,
      date: expense.date,
      from: id,
      to: expense.paidBy,
      amount: expense.shares[id],
      status: debtStatus(expense, id),
    }));
}

// True once every share someone owes on it is confirmed. An expense nobody owes
// anything on (only the payer shared it) was never settled.
export function isFullySettled(expense: Expense): boolean {
  const debts = debtsInExpense(expense);
  return debts.length > 0 && debts.every((debt) => debt.status === "settled");
}

// What `me` and one other person owe each other, counting only debts the
// payer hasn't confirmed yet (unpaid or pending verification).
export type PersonBalance = {
  personId: string;
  // Positive: they owe me. Negative: I owe them.
  net: number;
  debts: Debt[];
};

export function balancesFor(me: string, expenses: Expense[]): PersonBalance[] {
  const byPerson = new Map<string, PersonBalance>();

  for (const expense of expenses) {
    for (const debt of debtsInExpense(expense)) {
      if (debt.status === "settled") continue;
      const other = debt.from === me ? debt.to : debt.to === me ? debt.from : null;
      if (!other) continue;

      const balance = byPerson.get(other) ?? { personId: other, net: 0, debts: [] };
      balance.net += debt.to === me ? debt.amount : -debt.amount;
      balance.debts.push(debt);
      byPerson.set(other, balance);
    }
  }

  return [...byPerson.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

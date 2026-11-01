"use client";

import Link from "next/link";
import { debtsInExpense, type Debt } from "@/lib/balances";
import { memberName } from "@/lib/groups";
import { formatMoney, percentToInput } from "@/lib/money";
import type { Expense, Group } from "@/lib/types";
import { DebtStatusBadge } from "./DebtActions";
import { MemberAvatar } from "./ui";

export const SPLIT_LABELS = { equal: "equally", fixed: "by fixed amounts", percentage: "by percentage" };

// Everyone's share of one expense. `renderDebt` puts buttons next to each share
// (the expense page); without it each share just shows its status.
export function ExpenseShares({
  group,
  expense,
  me,
  renderDebt,
}: {
  group: Group;
  expense: Expense;
  me: string;
  renderDebt?: (debt: Debt) => React.ReactNode;
}) {
  const money = (minor: number) => formatMoney(minor, group.currency);
  const debts = debtsInExpense(expense);

  return (
    <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
      {expense.participantIds.map((id) => {
        const debt = debts.find((d) => d.from === id);
        const percentage = expense.percentages?.[id];
        return (
          <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <MemberAvatar group={group} uid={id} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{memberName(group, id, me)}</p>
                <p className="text-xs text-zinc-500">
                  {money(expense.shares[id])}
                  {percentage !== undefined && ` · ${percentToInput(percentage)}%`}
                  {id === expense.paidBy && " · paid the bill"}
                </p>
              </div>
            </div>
            {debt &&
              (renderDebt ? renderDebt(debt) : <DebtStatusBadge group={group} debt={debt} me={me} />)}
          </li>
        );
      })}
    </ul>
  );
}

// The expense page's breakup, read-only, for opening inside a list. The buttons
// (I've paid, Received, edit, delete) stay on the expense page.
export function ExpenseDetails({ group, expense, me }: { group: Group; expense: Expense; me: string }) {
  const payer = expense.paidBy === me ? "you" : memberName(group, expense.paidBy, me);

  return (
    <div className="rounded-lg bg-zinc-50 px-3 dark:bg-zinc-800/50">
      <p className="pt-3 text-xs text-zinc-500">
        Total {formatMoney(expense.amount, group.currency)} · Paid by {payer} · Split{" "}
        {SPLIT_LABELS[expense.splitType]}
      </p>
      {expense.notes && (
        <p className="mt-2 whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">
          {expense.notes}
        </p>
      )}
      <ExpenseShares group={group} expense={expense} me={me} />
      <Link
        href={`/groups/${group.id}/expenses/${expense.id}`}
        className="block pb-3 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        Open expense page →
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { balancesFor, type PersonBalance } from "@/lib/balances";
import { formatDate } from "@/lib/dates";
import { memberName } from "@/lib/groups";
import { formatMoney } from "@/lib/money";
import { sum } from "@/lib/split";
import type { Expense, Group } from "@/lib/types";
import { DebtActions } from "./DebtActions";
import { MemberAvatar } from "./ui";

type Props = {
  group: Group;
  expenses: Expense[];
  me: string;
  // Compact: headlines only, no per-expense rows or buttons (used on the dashboard).
  compact?: boolean;
};

export function BalanceList({ group, expenses, me, compact = false }: Props) {
  const balances = balancesFor(me, expenses);

  if (balances.length === 0) {
    return <p className="text-sm text-zinc-500">You&apos;re all settled up.</p>;
  }

  return (
    <ul className="space-y-4">
      {balances.map((balance) => (
        <PersonBalanceItem
          key={balance.personId}
          group={group}
          balance={balance}
          me={me}
          compact={compact}
        />
      ))}
    </ul>
  );
}

function PersonBalanceItem({
  group,
  balance,
  me,
  compact,
}: {
  group: Group;
  balance: PersonBalance;
  me: string;
  compact: boolean;
}) {
  const name = memberName(group, balance.personId, me);
  const money = (minor: number) => formatMoney(minor, group.currency);

  let headline: string;
  let tone: string;
  if (balance.net < 0) {
    headline = `You have to pay ${money(-balance.net)} to ${name}`;
    tone = "text-red-700 dark:text-red-400";
  } else if (balance.net > 0) {
    headline = `${name} owes you ${money(balance.net)}`;
    tone = "text-emerald-700 dark:text-emerald-400";
  } else {
    headline = `You and ${name} are even`;
    tone = "text-zinc-700 dark:text-zinc-300";
  }

  const pendingTotal = (fromMe: boolean) =>
    sum(
      balance.debts
        .filter((d) => d.status === "pending" && (d.from === me) === fromMe)
        .map((d) => d.amount),
    );
  const waitingOnThem = pendingTotal(true);
  const waitingOnMe = pendingTotal(false);

  return (
    <li>
      <div className="flex items-center gap-2">
        <MemberAvatar group={group} uid={balance.personId} />
        <p className={`text-sm font-medium ${tone}`}>{headline}</p>
      </div>
      {(waitingOnThem > 0 || waitingOnMe > 0) && (
        <p className="mt-1 ml-9 text-xs text-amber-800 dark:text-amber-300">
          {waitingOnThem > 0 && `${money(waitingOnThem)} waiting for ${name} to confirm. `}
          {waitingOnMe > 0 && `${money(waitingOnMe)} waiting for you to confirm.`}
        </p>
      )}

      {!compact && (
        <ul className="mt-2 ml-9 divide-y divide-zinc-100 dark:divide-zinc-800">
          {balance.debts.map((debt) => (
            <li
              key={`${debt.expenseId}-${debt.from}`}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="min-w-0">
                <Link
                  href={`/groups/${group.id}/expenses/${debt.expenseId}`}
                  className="text-sm font-medium hover:underline"
                >
                  {debt.description}
                </Link>
                <p className="text-xs text-zinc-500">
                  {formatDate(debt.date)} ·{" "}
                  {debt.from === me ? `you owe ${money(debt.amount)}` : `${name} owes ${money(debt.amount)}`}
                </p>
              </div>
              <DebtActions group={group} debt={debt} me={me} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

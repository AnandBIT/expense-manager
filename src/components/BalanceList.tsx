"use client";

import { balancesFor, type Debt, type PersonBalance } from "@/lib/balances";
import { formatDate } from "@/lib/dates";
import { memberName } from "@/lib/groups";
import { formatMoney } from "@/lib/money";
import { sum } from "@/lib/split";
import type { Expense, Group } from "@/lib/types";
import { Collapse } from "./Collapse";
import { DebtActions } from "./DebtActions";
import { ExpenseDetails } from "./ExpenseDetails";
import { Chevron, MemberAvatar } from "./ui";
import { useRememberedOpen } from "./useRememberedOpen";

type Props = {
  group: Group;
  expenses: Expense[];
  me: string;
};

// One line per person ("You have to pay ₹50 to Bob"). Opening it lists the
// expenses behind that balance, each with its buttons and a details dropdown.
export function BalanceList({ group, expenses, me }: Props) {
  const balances = balancesFor(me, expenses);

  if (balances.length === 0) {
    return <p className="text-sm text-zinc-500">You&apos;re all settled up.</p>;
  }

  const expensesById = new Map(expenses.map((expense) => [expense.id, expense]));
  return (
    <ul className="space-y-1">
      {balances.map((balance) => (
        <PersonBalanceItem
          key={balance.personId}
          group={group}
          balance={balance}
          me={me}
          expensesById={expensesById}
        />
      ))}
    </ul>
  );
}

function PersonBalanceItem({
  group,
  balance,
  me,
  expensesById,
}: {
  group: Group;
  balance: PersonBalance;
  me: string;
  expensesById: Map<string, Expense>;
}) {
  const [open, toggle] = useRememberedOpen(`person:${balance.personId}`);
  const name = memberName(group, balance.personId, me);
  const money = (minor: number) => formatMoney(minor, group.currency);
  const contentId = `person-${balance.personId}`;

  let headline: React.ReactNode;
  let tone: string;
  if (balance.net < 0) {
    headline = (
      <>
        You have to pay <strong className="font-semibold">{money(-balance.net)}</strong> to {name}
      </>
    );
    tone = "text-red-700 dark:text-red-400";
  } else if (balance.net > 0) {
    headline = (
      <>
        {name} owes you <strong className="font-semibold">{money(balance.net)}</strong>
      </>
    );
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
  const count = balance.debts.length;

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <MemberAvatar group={group} uid={balance.personId} />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm ${tone}`}>{headline}</span>
          {(waitingOnThem > 0 || waitingOnMe > 0) && (
            <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-300">
              {waitingOnThem > 0 && `${money(waitingOnThem)} waiting for ${name} to confirm. `}
              {waitingOnMe > 0 && `${money(waitingOnMe)} waiting for you to confirm.`}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs text-zinc-500">
          {count} {count === 1 ? "expense" : "expenses"}
        </span>
        <Chevron className={open ? "rotate-90" : ""} />
      </button>

      <Collapse open={open} id={contentId}>
        <ul className="mb-2 ml-9 divide-y divide-zinc-100 dark:divide-zinc-800">
          {balance.debts.map((debt) => (
            <DebtRow
              key={`${debt.expenseId}-${debt.from}`}
              group={group}
              debt={debt}
              me={me}
              name={name}
              expense={expensesById.get(debt.expenseId)}
            />
          ))}
        </ul>
      </Collapse>
    </li>
  );
}

// The row's title opens a read-only summary of the whole expense; the buttons
// stay next to it.
function DebtRow({
  group,
  debt,
  me,
  name,
  expense,
}: {
  group: Group;
  debt: Debt;
  me: string;
  name: string;
  expense?: Expense;
}) {
  const [open, toggle] = useRememberedOpen(`debt:${debt.expenseId}:${debt.from}`);
  const money = (minor: number) => formatMoney(minor, group.currency);
  const detailsId = `details-${debt.expenseId}-${debt.from}`;

  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={toggle}
          className="flex min-w-0 items-start gap-1 text-left"
        >
          <Chevron className={`mt-0.5 ${open ? "rotate-90" : ""}`} />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{debt.description}</span>
            <span className="block text-xs text-zinc-500">
              {formatDate(debt.date)} ·{" "}
              {debt.from === me ? `you owe ${money(debt.amount)}` : `${name} owes ${money(debt.amount)}`}
            </span>
          </span>
        </button>
        <DebtActions group={group} debt={debt} me={me} />
      </div>

      {expense && (
        <Collapse open={open} id={detailsId} className="pt-2">
          <ExpenseDetails group={group} expense={expense} me={me} />
        </Collapse>
      )}
    </li>
  );
}

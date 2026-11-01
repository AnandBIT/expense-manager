"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { debtStatus, debtsInExpense, isFullySettled } from "@/lib/balances";
import { formatDate } from "@/lib/dates";
import {
  EXPENSE_SORTS,
  expenseSections,
  sortExpenses,
  type ExpenseSection,
  type ExpenseSort,
} from "@/lib/expenseList";
import { memberName } from "@/lib/groups";
import { formatMoney } from "@/lib/money";
import { sum } from "@/lib/split";
import type { Expense, Group } from "@/lib/types";
import { recall, remember } from "@/lib/viewMemory";
import { Collapse } from "./Collapse";
import { ExpenseDetails } from "./ExpenseDetails";
import { SegmentedControl } from "./SegmentedControl";
import { Switch } from "./Switch";
import { Badge, Chevron } from "./ui";
import { useRememberedOpen } from "./useRememberedOpen";

// Rows glide to their new place when the sort changes.
const REORDER = { type: "spring", bounce: 0.15, duration: 0.45 } as const;

function sortFrom(value: string | null): ExpenseSort {
  return EXPENSE_SORTS.find((option) => option.value === value)?.value ?? "date";
}

type Props = {
  group: Group;
  // undefined while loading.
  expenses?: Expense[];
  me: string;
};

// The sort and the grouped (accordion) view live in the URL, e.g.
// ?sort=amount&view=grouped, so they survive the browser's back button. The
// "←" links don't carry the URL's query, so coming back that way uses the view
// you left (see viewMemory); arriving afresh starts sorted by date.
export function ExpenseList({ group, expenses, me }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = searchParams.toString() ? searchParams : new URLSearchParams(recall(pathname, "view") ?? "");
  const sort = sortFrom(params.get("sort"));
  const grouped = params.get("view") === "grouped";
  const nameOf = (uid: string) => memberName(group, uid, me);
  const sorted = expenses ? sortExpenses(expenses, sort, me, nameOf) : [];

  // Replacing the history entry updates useSearchParams without a server round-trip.
  function show(view: { sort: ExpenseSort; grouped: boolean }) {
    const next = new URLSearchParams();
    if (view.sort !== "date") next.set("sort", view.sort);
    if (view.grouped) next.set("view", "grouped");
    const query = next.toString();
    remember(pathname, "view", query);
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-500">Expenses</h2>
        {sorted.length > 0 && (
          <Switch
            label={sort === "payer" ? "Group by person" : "Group by day"}
            checked={grouped}
            onChange={(next) => show({ sort, grouped: next })}
          />
        )}
      </div>
      {sorted.length > 0 && (
        <SegmentedControl
          label="Sort expenses by"
          options={EXPENSE_SORTS}
          value={sort}
          onChange={(next) => show({ sort: next, grouped })}
          className="mt-3"
        />
      )}

      {!expenses ? null : sorted.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No expenses yet.</p>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={grouped ? "grouped" : "list"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {grouped ? (
              <ul className="mt-3 space-y-2">
                {expenseSections(sorted, sort).map((section) => (
                  <motion.li key={section.key} layout="position" transition={REORDER}>
                    <SectionItem group={group} section={section} sort={sort} me={me} />
                  </motion.li>
                ))}
              </ul>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                {sorted.map((expense) => (
                  <motion.li key={expense.id} layout="position" transition={REORDER}>
                    <ExpenseRow group={group} expense={expense} me={me} />
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}

// One day (or one payer) in the grouped view, with what was spent in total.
function SectionItem({
  group,
  section,
  sort,
  me,
}: {
  group: Group;
  section: ExpenseSection;
  sort: ExpenseSort;
  me: string;
}) {
  const kind = sort === "payer" ? "payer" : "day";
  const [open, toggle] = useRememberedOpen(`${kind}:${section.key}`);
  const count = section.expenses.length;
  const contentId = `section-${kind}-${section.key}`;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {kind === "payer" ? `${memberName(group, section.key, me)} paid` : formatDate(section.key)}
          </span>
          <span className="block text-xs text-zinc-500">
            {count} {count === 1 ? "expense" : "expenses"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums">
          Total {formatMoney(section.total, group.currency)}
          <Chevron className={open ? "rotate-90" : ""} />
        </span>
      </button>
      <Collapse open={open} id={contentId}>
        <ul className="divide-y divide-zinc-100 border-t border-zinc-200 px-3 dark:divide-zinc-800 dark:border-zinc-800">
          {section.expenses.map((expense) => (
            <motion.li key={expense.id} layout="position" transition={REORDER}>
              <ExpenseRow group={group} expense={expense} me={me} />
            </motion.li>
          ))}
        </ul>
      </Collapse>
    </div>
  );
}

// Opens the expense's breakup in place; the full page is linked from there.
function ExpenseRow({ group, expense, me }: { group: Group; expense: Expense; me: string }) {
  const [open, toggle] = useRememberedOpen(`expense:${expense.id}`);
  const money = (minor: number) => formatMoney(minor, group.currency);
  const detailsId = `expense-${expense.id}`;

  let involvement: React.ReactNode;
  if (expense.paidBy === me) {
    const lent = sum(debtsInExpense(expense).map((debt) => debt.amount));
    involvement = lent > 0 ? `you lent ${money(lent)}` : "only you";
  } else if (expense.shares[me] > 0) {
    const status = debtStatus(expense, me);
    involvement = (
      <span className={status === "unpaid" ? "text-red-700 dark:text-red-400" : undefined}>
        your share {money(expense.shares[me])}
        {status === "pending" && " · pending"}
      </span>
    );
  } else {
    involvement = "not involved";
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={toggle}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span className="flex min-w-0 items-start gap-1">
          <Chevron className={`mt-0.5 ${open ? "rotate-90" : ""}`} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{expense.description}</span>
            <span className="block text-xs text-zinc-500">
              {formatDate(expense.date)} · {memberName(group, expense.paidBy, me)} paid{" "}
              {money(expense.amount)}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-zinc-500">
          {involvement}
          {isFullySettled(expense) && <Badge tone="settled">Settled</Badge>}
        </span>
      </button>
      <Collapse open={open} id={detailsId} className="pb-3">
        <ExpenseDetails group={group} expense={expense} me={me} />
      </Collapse>
    </>
  );
}

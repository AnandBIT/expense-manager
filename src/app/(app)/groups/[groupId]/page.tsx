"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSignedInUser } from "@/components/AuthProvider";
import { BalanceList } from "@/components/BalanceList";
import {
  BackLink,
  Badge,
  Card,
  ErrorText,
  Loading,
  MemberAvatar,
  buttonClass,
  errorMessage,
  inputClass,
} from "@/components/ui";
import { debtStatus, debtsInExpense, isFullySettled } from "@/lib/balances";
import { formatDate } from "@/lib/dates";
import { inviteUrl, memberName } from "@/lib/groups";
import { useExpenses, useGroup } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";
import { sum } from "@/lib/split";
import type { Expense, Group } from "@/lib/types";

export default function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const me = useSignedInUser().uid;
  const { data: group, error: groupError } = useGroup(groupId);
  const { data: expenses, error: expensesError } = useExpenses(groupId);

  if (groupError) {
    return (
      <div className="space-y-4">
        <BackLink href="/dashboard">All groups</BackLink>
        <ErrorText>This group doesn&apos;t exist, or you&apos;re not a member of it.</ErrorText>
      </div>
    );
  }
  if (!group) return <Loading />;

  return (
    <div className="space-y-5">
      <BackLink href="/dashboard">All groups</BackLink>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-zinc-500">
            {group.currency} · {group.memberIds.length}{" "}
            {group.memberIds.length === 1 ? "member" : "members"}
          </p>
        </div>
        <Link href={`/groups/${groupId}/expenses/new`} className={buttonClass("primary")}>
          Add expense
        </Link>
      </div>

      <Card>
        <h2 className="text-sm font-medium text-zinc-500">Your balances</h2>
        <div className="mt-3">
          {expensesError ? (
            <ErrorText>{errorMessage(expensesError)}</ErrorText>
          ) : expenses ? (
            <BalanceList group={group} expenses={expenses} me={me} />
          ) : (
            <Loading />
          )}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-zinc-500">Expenses</h2>
        {!expenses ? null : expenses.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No expenses yet.</p>
        ) : (
          <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {expenses.map((expense) => (
              <ExpenseRow key={expense.id} group={group} expense={expense} me={me} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-zinc-500">Members</h2>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {group.memberIds.map((id) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <MemberAvatar group={group} uid={id} />
              {memberName(group, id, me)}
            </li>
          ))}
        </ul>
        <InviteLink group={group} />
      </Card>
    </div>
  );
}

function ExpenseRow({ group, expense, me }: { group: Group; expense: Expense; me: string }) {
  const money = (minor: number) => formatMoney(minor, group.currency);

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
    <li>
      <Link
        href={`/groups/${group.id}/expenses/${expense.id}`}
        className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{expense.description}</p>
          <p className="text-xs text-zinc-500">
            {formatDate(expense.date)} · {memberName(group, expense.paidBy, me)} paid{" "}
            {money(expense.amount)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-zinc-500">
          {involvement}
          {isFullySettled(expense) && <Badge tone="settled">Settled</Badge>}
        </div>
      </Link>
    </li>
  );
}

function InviteLink({ group }: { group: Group }) {
  const [copied, setCopied] = useState(false);
  const url = inviteUrl(group);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">
        To add people, send them this link. Anyone with it can join after signing in with Google.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={url}
          aria-label="Invite link"
          onFocus={(e) => e.target.select()}
          className={`${inputClass} font-mono text-xs`}
        />
        <button type="button" onClick={copy} className={buttonClass("secondary")}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

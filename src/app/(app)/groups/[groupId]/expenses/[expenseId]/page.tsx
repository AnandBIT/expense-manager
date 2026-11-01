"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSignedInUser } from "@/components/AuthProvider";
import { DebtActions } from "@/components/DebtActions";
import { ExpenseShares, SPLIT_LABELS } from "@/components/ExpenseDetails";
import { BackLink, Card, ErrorText, Loading, buttonClass, errorMessage } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { deleteExpense } from "@/lib/expenses";
import { isDeletionApproved, memberName } from "@/lib/groups";
import { useExpense, useGroup } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";

export default function ExpensePage() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const me = useSignedInUser().uid;
  const router = useRouter();
  const { data: group, error: groupError } = useGroup(groupId);
  const { data: expense, error: expenseError } = useExpense(groupId, expenseId);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (groupError || expenseError) {
    return <ErrorText>This expense doesn&apos;t exist, or you&apos;re not a member of its group.</ErrorText>;
  }
  if (!group || expense === undefined) return <Loading />;
  if (expense === null) {
    return (
      <div className="space-y-4">
        <BackLink href={`/groups/${groupId}`}>{group.name}</BackLink>
        <p className="text-sm text-zinc-500">This expense was deleted.</p>
      </div>
    );
  }

  const money = (minor: number) => formatMoney(minor, group.currency);
  const isPayer = expense.paidBy === me;
  const locked = Object.keys(expense.settled).length > 0;
  const payerName = isPayer ? "you" : memberName(group, expense.paidBy, me);

  async function handleDelete() {
    if (!window.confirm("Delete this expense? This can't be undone.")) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteExpense(groupId, expenseId);
      router.replace(`/groups/${groupId}`);
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <BackLink href={`/groups/${groupId}`}>{group.name}</BackLink>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{expense.description}</h1>
          <p className="text-sm text-zinc-500">
            {formatDate(expense.date)} · Paid by {payerName} · Split {SPLIT_LABELS[expense.splitType]}
          </p>
        </div>
        <p className="shrink-0 text-xl font-semibold">{money(expense.amount)}</p>
      </div>

      {expense.notes && (
        <Card>
          <h2 className="text-sm font-medium text-zinc-500">Notes</h2>
          <p className="mt-1 whitespace-pre-line text-sm">{expense.notes}</p>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-medium text-zinc-500">Shares</h2>
        <ExpenseShares
          group={group}
          expense={expense}
          me={me}
          renderDebt={(debt) => <DebtActions group={group} debt={debt} me={me} />}
        />
      </Card>

      {isPayer && (
        <div className="space-y-2">
          {isDeletionApproved(group) ? (
            <p className="text-xs text-zinc-500">
              This group is being deleted, so its expenses can no longer change.
            </p>
          ) : locked ? (
            <p className="text-xs text-zinc-500">
              Some payments on this expense are confirmed, so it can no longer be edited or deleted.
            </p>
          ) : (
            <div className="flex gap-2">
              <Link
                href={`/groups/${groupId}/expenses/${expenseId}/edit`}
                className={buttonClass("secondary")}
              >
                Edit
              </Link>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={buttonClass("danger")}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
          {error && <ErrorText>{error}</ErrorText>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import { useSignedInUser } from "@/components/AuthProvider";
import { ExpenseForm } from "@/components/ExpenseForm";
import { BackLink, ErrorText, Loading } from "@/components/ui";
import { updateExpense } from "@/lib/expenses";
import { isDeletionApproved } from "@/lib/groups";
import { useExpense, useGroup } from "@/lib/hooks";

export default function EditExpensePage() {
  const { groupId, expenseId } = useParams<{ groupId: string; expenseId: string }>();
  const me = useSignedInUser().uid;
  const router = useRouter();
  const { data: group, error: groupError } = useGroup(groupId);
  const { data: expense, error: expenseError } = useExpense(groupId, expenseId);
  const expensePath = `/groups/${groupId}/expenses/${expenseId}`;

  if (groupError || expenseError) {
    return <ErrorText>This expense doesn&apos;t exist, or you&apos;re not a member of its group.</ErrorText>;
  }
  if (!group || expense === undefined) return <Loading />;

  let blocked: string | null = null;
  if (expense === null) blocked = "This expense was deleted.";
  else if (expense.paidBy !== me) blocked = "Only the person who added this expense can edit it.";
  else if (Object.keys(expense.settled).length > 0) {
    blocked = "Some payments on this expense are confirmed, so it can no longer be edited.";
  } else if (isDeletionApproved(group)) {
    blocked = "This group is being deleted, so its expenses can no longer change.";
  }

  return (
    <div className="space-y-4">
      <BackLink href={expense ? expensePath : `/groups/${groupId}`}>
        {expense?.description ?? group.name}
      </BackLink>
      <h1 className="text-xl font-semibold">Edit expense</h1>

      {blocked || !expense ? (
        <p className="text-sm text-zinc-500">{blocked}</p>
      ) : (
        <>
          {Object.keys(expense.paidMarks).length > 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              Saving will clear the &quot;I&apos;ve paid&quot; marks on this expense, so those people
              will need to mark their payment again.
            </p>
          )}
          <ExpenseForm
            group={group}
            me={me}
            initial={expense}
            submitLabel="Save changes"
            onSubmit={async (input) => {
              await updateExpense(groupId, expenseId, input);
              router.replace(expensePath);
            }}
          />
        </>
      )}
    </div>
  );
}

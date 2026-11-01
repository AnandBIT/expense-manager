"use client";

import { useParams, useRouter } from "next/navigation";
import { useSignedInUser } from "@/components/AuthProvider";
import { ExpenseForm } from "@/components/ExpenseForm";
import { BackLink, ErrorText, Loading } from "@/components/ui";
import { createExpense } from "@/lib/expenses";
import { useGroup } from "@/lib/hooks";

export default function NewExpensePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const me = useSignedInUser().uid;
  const router = useRouter();
  const { data: group, error } = useGroup(groupId);

  if (error) return <ErrorText>This group doesn&apos;t exist, or you&apos;re not a member of it.</ErrorText>;
  if (!group) return <Loading />;

  return (
    <div className="space-y-4">
      <BackLink href={`/groups/${groupId}`}>{group.name}</BackLink>
      <h1 className="text-xl font-semibold">Add expense</h1>
      <ExpenseForm
        group={group}
        me={me}
        submitLabel="Add expense"
        onSubmit={async (input) => {
          await createExpense(groupId, me, input);
          router.replace(`/groups/${groupId}`);
        }}
      />
    </div>
  );
}

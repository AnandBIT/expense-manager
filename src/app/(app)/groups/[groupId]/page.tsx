"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSignedInUser } from "@/components/AuthProvider";
import { BalanceList } from "@/components/BalanceList";
import { DeletionBanner } from "@/components/DeletionBanner";
import { ExpenseList } from "@/components/ExpenseList";
import { InviteLink } from "@/components/InviteLink";
import {
  BackLink,
  Card,
  ErrorText,
  Loading,
  MemberAvatar,
  buttonClass,
  errorMessage,
} from "@/components/ui";
import { isDeletionApproved, memberName } from "@/lib/groups";
import { useExpenses, useGroup } from "@/lib/hooks";

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
      <DeletionBanner group={group} me={me} />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{group.name}</h1>
          <p className="text-sm text-zinc-500">
            {group.currency} · {group.memberIds.length}{" "}
            {group.memberIds.length === 1 ? "member" : "members"}
          </p>
        </div>
        {/* Once everyone has approved deleting the group, no new expenses. */}
        {isDeletionApproved(group) ? (
          <button type="button" disabled className={buttonClass("primary")}>
            Add expense
          </button>
        ) : (
          <Link href={`/groups/${groupId}/expenses/new`} className={buttonClass("primary")}>
            Add expense
          </Link>
        )}
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
        <ExpenseList group={group} expenses={expenses} me={me} />
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-zinc-500">Members</h2>
          <Link
            href={`/groups/${groupId}/settings`}
            className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            Manage group
          </Link>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {group.memberIds.map((id) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <MemberAvatar group={group} uid={id} />
              {memberName(group, id, me)}
            </li>
          ))}
        </ul>
        <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <InviteLink group={group} />
        </div>
      </Card>
    </div>
  );
}

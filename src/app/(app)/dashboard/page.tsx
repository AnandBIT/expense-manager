"use client";

import Link from "next/link";
import { useSignedInUser } from "@/components/AuthProvider";
import { BalanceList } from "@/components/BalanceList";
import { Avatar, Card, ErrorText, Loading, buttonClass, errorMessage } from "@/components/ui";
import { useExpenses, useMyGroups } from "@/lib/hooks";
import type { Group } from "@/lib/types";

export default function DashboardPage() {
  const user = useSignedInUser();
  const { data: groups, error } = useMyGroups(user.uid);
  const name = user.displayName || user.email || "You";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Avatar name={name} photoURL={user.photoURL ?? undefined} size={48} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{name}</h1>
          <p className="truncate text-sm text-zinc-500">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your groups</h2>
        <Link href="/groups/new" className={buttonClass("primary")}>
          New group
        </Link>
      </div>

      {error ? (
        <ErrorText>{errorMessage(error)}</ErrorText>
      ) : !groups ? (
        <Loading />
      ) : groups.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You&apos;re not in any groups yet. Create one, or ask a friend to send you their
            group&apos;s invite link.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.id}>
              <GroupCard group={group} me={user.uid} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupCard({ group, me }: { group: Group; me: string }) {
  const { data: expenses, error } = useExpenses(group.id);

  return (
    <Link
      href={`/groups/${group.id}`}
      className="block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="truncate font-medium">{group.name}</h3>
        <span className="shrink-0 text-xs text-zinc-500">
          {group.memberIds.length} {group.memberIds.length === 1 ? "member" : "members"} ·{" "}
          {group.currency}
        </span>
      </div>
      <div className="mt-3">
        {error ? (
          <ErrorText>{errorMessage(error)}</ErrorText>
        ) : expenses ? (
          <BalanceList group={group} expenses={expenses} me={me} compact />
        ) : (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}
      </div>
    </Link>
  );
}

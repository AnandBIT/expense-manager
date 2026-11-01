"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useSignedInUser } from "@/components/AuthProvider";
import {
  Avatar,
  Badge,
  Card,
  Chevron,
  ErrorText,
  Loading,
  buttonClass,
  errorMessage,
} from "@/components/ui";
import { isDeletionApproved } from "@/lib/groups";
import { useMyGroups } from "@/lib/hooks";
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
          <h1 className="truncate text-xl font-semibold tracking-tight">{name}</h1>
          <p className="truncate text-sm text-zinc-500">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Your groups</h2>
        <Link href="/groups/new" className={buttonClass("primary")}>
          New group
        </Link>
      </div>

      {error ? (
        <ErrorText>{errorMessage(error)}</ErrorText>
      ) : !groups ? (
        <Loading />
      ) : groups.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
              <circle cx="9" cy="8" r="3" />
              <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
              <path d="M16 11a3 3 0 1 0 0-6M17.5 19h3a5.5 5.5 0 0 0-4-5.3" />
            </svg>
          </span>
          <p className="max-w-xs text-sm text-zinc-600 dark:text-zinc-400">
            You&apos;re not in any groups yet. Create one, or ask a friend to send you their
            group&apos;s invite link.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {groups.map((group, index) => (
            <motion.li
              key={group.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04 }}
            >
              <GroupCard group={group} me={user.uid} />
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Just the group: showing balances here would read every expense of every
// group on each visit. They're one tap away on the group page.
function GroupCard({ group, me }: { group: Group; me: string }) {
  return (
    <Link
      href={`/groups/${group.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-950/3 transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md active:translate-y-0 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      >
        {group.name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{group.name}</span>
        <span className="block text-xs text-zinc-500">
          {group.memberIds.length} {group.memberIds.length === 1 ? "member" : "members"} ·{" "}
          {group.currency}
        </span>
        {group.deletion && (
          <span className="mt-1.5 block">
            <Badge tone="pending">
              {isDeletionApproved(group)
                ? "Everyone approved deleting it: open it to finish"
                : group.deletion.approvedBy.includes(me)
                  ? "Waiting for others to approve deleting it"
                  : "Asked to delete: needs your approval"}
            </Badge>
          </span>
        )}
      </span>
      <Chevron className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

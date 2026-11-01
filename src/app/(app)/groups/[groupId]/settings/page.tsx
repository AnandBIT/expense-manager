"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSignedInUser } from "@/components/AuthProvider";
import { DeletionBanner } from "@/components/DeletionBanner";
import { InviteLink } from "@/components/InviteLink";
import {
  BackLink,
  Card,
  ErrorText,
  Loading,
  MemberAvatar,
  buttonClass,
  errorMessage,
  inputClass,
} from "@/components/ui";
import { useAction } from "@/components/useAction";
import { balancesFor } from "@/lib/balances";
import {
  finishDeletion,
  isDeletionApproved,
  leaveGroup,
  memberName,
  removeMember,
  renameGroup,
  requestDeletion,
  resetInviteLink,
} from "@/lib/groups";
import { useExpenses, useGroup } from "@/lib/hooks";
import type { Expense, Group } from "@/lib/types";

export default function GroupSettingsPage() {
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
    <div className="space-y-4">
      <BackLink href={`/groups/${groupId}`}>{group.name}</BackLink>
      <h1 className="text-xl font-semibold">Group settings</h1>
      <DeletionBanner group={group} me={me} />

      {/* Once everyone has approved deleting it, the group can only be deleted. */}
      {!isDeletionApproved(group) && (
        <>
          <RenameCard key={group.name} group={group} />
          {expensesError && <ErrorText>{errorMessage(expensesError)}</ErrorText>}
          <MembersCard group={group} me={me} expenses={expenses} />
          <InviteCard group={group} />
          {!group.deletion && <DeleteCard group={group} me={me} />}
        </>
      )}
    </div>
  );
}

function RenameCard({ group }: { group: Group }) {
  const [name, setName] = useState(group.name);
  const { busy, error, run } = useAction();
  const trimmed = name.trim();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void run(() => renameGroup(group, trimmed));
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Group name</span>
          <input
            className={`${inputClass} mt-1`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
          />
        </label>
        {error && <ErrorText>{error}</ErrorText>}
        <button
          type="submit"
          disabled={busy || !trimmed || trimmed === group.name}
          className={buttonClass("primary")}
        >
          {busy ? "Saving…" : "Save name"}
        </button>
      </form>
    </Card>
  );
}

// Nobody leaves or is removed while they still owe or are owed money: once
// they're gone, they can't confirm payments or mark theirs as paid. Rules can't
// scan the expenses to check this, so the app does.
function MembersCard({ group, me, expenses }: { group: Group; me: string; expenses?: Expense[] }) {
  const router = useRouter();
  const { busy, error, run } = useAction();
  const alone = group.memberIds.length === 1;

  function remove(uid: string) {
    const name = memberName(group, uid, me);
    const question = `Remove ${name} from ${group.name}? They'll lose access to the group. This also resets the invite link, so anyone waiting to join will need the new one.`;
    if (window.confirm(question)) void run(() => removeMember(group, uid));
  }

  function leave() {
    if (!window.confirm(`Leave ${group.name}? You can rejoin later with the invite link.`)) return;
    void run(async () => {
      await leaveGroup(group.id, me);
      router.replace("/dashboard");
    });
  }

  return (
    <Card>
      <h2 className="text-sm font-medium text-zinc-500">Members</h2>
      <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
        {group.memberIds.map((id) => {
          const isMe = id === me;
          const hasOpenShares = expenses !== undefined && balancesFor(id, expenses).length > 0;
          let note: string | null = null;
          if (isMe && alone) note = "You're the only member. Delete the group instead.";
          else if (hasOpenShares && isMe) note = "Settle all your shares before leaving.";
          else if (hasOpenShares) note = "Has unsettled shares, so can't be removed yet.";

          return (
            <li key={id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <MemberAvatar group={group} uid={id} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{memberName(group, id, me)}</p>
                  {note && <p className="text-xs text-zinc-500">{note}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => (isMe ? leave() : remove(id))}
                disabled={busy || !expenses || hasOpenShares || (isMe && alone)}
                className={buttonClass(isMe ? "danger" : "secondary", "sm")}
              >
                {isMe ? "Leave" : "Remove"}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}

function InviteCard({ group }: { group: Group }) {
  const { busy, error, run } = useAction();

  function reset() {
    const question = "Reset the invite link? The current link stops working, and only the new one will let people join.";
    if (window.confirm(question)) void run(() => resetInviteLink(group));
  }

  return (
    <Card className="space-y-3">
      <h2 className="text-sm font-medium text-zinc-500">Invite link</h2>
      <div>
        <InviteLink group={group} />
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      <button type="button" onClick={reset} disabled={busy} className={buttonClass("secondary", "sm")}>
        {busy ? "Resetting…" : "Reset link"}
      </button>
    </Card>
  );
}

function DeleteCard({ group, me }: { group: Group; me: string }) {
  const router = useRouter();
  const { busy, error, run } = useAction();
  const alone = group.memberIds.length === 1;

  function handleDelete() {
    const question = alone
      ? `Delete ${group.name} and all its expenses? This can't be undone.`
      : `Ask everyone to approve deleting ${group.name}? It's deleted for everyone, with all its expenses, once every member approves.`;
    if (!window.confirm(question)) return;
    void run(async () => {
      await requestDeletion(group.id, me);
      // On your own, asking is already everyone's approval.
      if (alone) {
        await finishDeletion(group.id);
        router.replace("/dashboard");
      }
    });
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-sm font-medium text-zinc-500">Delete group</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {alone
            ? "This deletes the group and all its expenses."
            : "Every member has to approve before the group and its expenses are deleted. Until then, anyone can reject it."}
        </p>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      <button type="button" onClick={handleDelete} disabled={busy} className={buttonClass("danger")}>
        {alone ? (busy ? "Deleting…" : "Delete group") : busy ? "Asking…" : "Ask to delete group"}
      </button>
    </Card>
  );
}

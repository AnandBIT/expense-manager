"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  approveDeletion,
  cancelDeletion,
  finishDeletion,
  isDeletionApproved,
  memberName,
} from "@/lib/groups";
import type { Group, GroupDeletion } from "@/lib/types";
import { ErrorText, buttonClass } from "./ui";
import { useAction } from "./useAction";

// Shown while someone has asked to delete the group. It's deleted for everyone
// once every member approves, and anyone can reject it until then.
export function DeletionBanner({ group, me }: { group: Group; me: string }) {
  return (
    <AnimatePresence initial={false}>
      {group.deletion && (
        <motion.div
          key="deletion"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden"
        >
          <DeletionRequest group={group} deletion={group.deletion} me={me} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DeletionRequest({ group, deletion, me }: { group: Group; deletion: GroupDeletion; me: string }) {
  const router = useRouter();
  const { busy, error, run } = useAction();

  const waitingFor = group.memberIds.filter((id) => !deletion.approvedBy.includes(id));
  const waitingNames = waitingFor
    .map((id) => (id === me ? "you" : memberName(group, id, me)))
    .join(", ");
  const asker = memberName(group, deletion.requestedBy, me);
  const lastToApprove = waitingFor.length === 1 && waitingFor[0] === me;

  function deleteForEveryone() {
    if (!window.confirm(`Delete ${group.name} and all its expenses for everyone? This can't be undone.`)) {
      return;
    }
    void run(async () => {
      if (lastToApprove) await approveDeletion(group.id, me);
      await finishDeletion(group.id);
      router.replace("/dashboard");
    });
  }

  const reject = () => run(() => cancelDeletion(group.id));

  let message: string;
  let actions: React.ReactNode;
  if (isDeletionApproved(group)) {
    message = "Everyone has approved deleting this group.";
    actions = (
      <button type="button" onClick={deleteForEveryone} disabled={busy} className={buttonClass("danger", "sm")}>
        {busy ? "Deleting…" : "Finish deleting"}
      </button>
    );
  } else if (deletion.approvedBy.includes(me)) {
    message = `${asker} asked to delete this group. Waiting for ${waitingNames} to approve.`;
    actions = (
      <button type="button" onClick={reject} disabled={busy} className={buttonClass("secondary", "sm")}>
        Cancel deletion
      </button>
    );
  } else {
    message = `${asker} wants to delete this group and all its expenses. It's deleted for everyone once every member approves. Waiting for ${waitingNames}.`;
    actions = (
      <>
        <button
          type="button"
          onClick={lastToApprove ? deleteForEveryone : () => run(() => approveDeletion(group.id, me))}
          disabled={busy}
          className={buttonClass("danger", "sm")}
        >
          {busy && lastToApprove ? "Deleting…" : lastToApprove ? "Approve and delete" : "Approve"}
        </button>
        <button type="button" onClick={reject} disabled={busy} className={buttonClass("secondary", "sm")}>
          Reject
        </button>
      </>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-200">
      <p>{message}</p>
      <div className="flex flex-wrap gap-2">{actions}</div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

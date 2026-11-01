"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Debt } from "@/lib/balances";
import { clearPaidMark, confirmReceived, markPaid } from "@/lib/expenses";
import { isDeletionApproved, memberName } from "@/lib/groups";
import { formatMoney } from "@/lib/money";
import type { Group } from "@/lib/types";
import { Badge, buttonClass } from "./ui";
import { useAction } from "./useAction";

// The status of one share, plus whatever the viewer is allowed to do about it:
// the person who owes can say "I've paid"; only the payer can confirm receipt.
export function DebtActions({ group, debt, me }: { group: Group; debt: Debt; me: string }) {
  const { busy, error, run } = useAction();

  const debtor = memberName(group, debt.from, me);
  const amount = formatMoney(debt.amount, group.currency);

  function confirmReceipt() {
    const ok = window.confirm(`Confirm you received ${amount} from ${debtor}? This can't be undone.`);
    if (ok) void run(() => confirmReceived(group.id, debt.expenseId, debt.from));
  }

  let content: React.ReactNode;
  if (debt.status === "settled" || isDeletionApproved(group)) {
    // Nothing can change once a share is settled, or once the group is being deleted.
    content = <DebtStatusBadge group={group} debt={debt} me={me} />;
  } else if (debt.from === me && debt.status === "unpaid") {
    content = (
      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => markPaid(group.id, debt.expenseId, me))}
        className={buttonClass("primary", "sm")}
      >
        I&apos;ve paid
      </button>
    );
  } else if (debt.from === me) {
    content = (
      <>
        <DebtStatusBadge group={group} debt={debt} me={me} />
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => clearPaidMark(group.id, debt.expenseId, me))}
          className="text-xs text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Undo
        </button>
      </>
    );
  } else if (debt.to === me && debt.status === "pending") {
    content = (
      <>
        <Badge tone="pending">{debtor} says they&apos;ve paid</Badge>
        <button type="button" disabled={busy} onClick={confirmReceipt} className={buttonClass("primary", "sm")}>
          Received {amount}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => clearPaidMark(group.id, debt.expenseId, debt.from))}
          className={buttonClass("secondary", "sm")}
        >
          Not received
        </button>
      </>
    );
  } else if (debt.to === me) {
    content = (
      <button type="button" disabled={busy} onClick={confirmReceipt} className={buttonClass("secondary", "sm")}>
        Mark as received
      </button>
    );
  } else {
    content = <DebtStatusBadge group={group} debt={debt} me={me} />;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {/* Unpaid → pending → settled swaps in place rather than jumping. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={debt.status}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="flex flex-wrap items-center justify-end gap-2"
        >
          {content}
        </motion.div>
      </AnimatePresence>
      {error && (
        <p role="alert" className="w-full text-right text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

// The status of one share with no buttons, for anyone looking at it.
export function DebtStatusBadge({ group, debt, me }: { group: Group; debt: Debt; me: string }) {
  if (debt.status === "settled") return <Badge tone="settled">Settled</Badge>;
  if (debt.status === "unpaid") return <Badge tone="unpaid">Unpaid</Badge>;
  if (debt.to === me) return <Badge tone="pending">Waiting for you to confirm</Badge>;
  return <Badge tone="pending">Pending verification from {memberName(group, debt.to, me)}</Badge>;
}

"use client";

import { useState } from "react";
import type { Debt } from "@/lib/balances";
import { clearPaidMark, confirmReceived, markPaid } from "@/lib/expenses";
import { memberName } from "@/lib/groups";
import { formatMoney } from "@/lib/money";
import type { Group } from "@/lib/types";
import { Badge, buttonClass, errorMessage } from "./ui";

// The status of one share, plus whatever the viewer is allowed to do about it:
// the person who owes can say "I've paid"; only the payer can confirm receipt.
export function DebtActions({ group, debt, me }: { group: Group; debt: Debt; me: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payer = memberName(group, debt.to, me);
  const debtor = memberName(group, debt.from, me);
  const amount = formatMoney(debt.amount, group.currency);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmReceipt() {
    const ok = window.confirm(`Confirm you received ${amount} from ${debtor}? This can't be undone.`);
    if (ok) void run(() => confirmReceived(group.id, debt.expenseId, debt.from));
  }

  let content: React.ReactNode;
  if (debt.status === "settled") {
    content = <Badge tone="settled">Settled</Badge>;
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
        <Badge tone="pending">Pending verification from {payer}</Badge>
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
    content =
      debt.status === "pending" ? (
        <Badge tone="pending">Pending verification from {payer}</Badge>
      ) : (
        <Badge tone="unpaid">Unpaid</Badge>
      );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {content}
      {error && (
        <p role="alert" className="w-full text-right text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

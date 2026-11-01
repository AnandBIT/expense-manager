"use client";

import { useState } from "react";
import { today } from "@/lib/dates";
import { memberName } from "@/lib/groups";
import {
  amountToInput,
  formatMoney,
  parseAmount,
  parsePercent,
  percentToInput,
} from "@/lib/money";
import { splitByPercentage, splitEqually, sum } from "@/lib/split";
import type { Expense, ExpenseInput, Group, SplitType } from "@/lib/types";
import {
  Card,
  ErrorText,
  MemberAvatar,
  buttonClass,
  errorMessage,
  inputBaseClass,
  inputClass,
} from "./ui";

const SPLIT_TYPES: { value: SplitType; label: string }[] = [
  { value: "equal", label: "Equally" },
  { value: "fixed", label: "Fixed amounts" },
  { value: "percentage", label: "Percentages" },
];

type Props = {
  group: Group;
  me: string;
  initial?: Expense;
  submitLabel: string;
  onSubmit: (input: ExpenseInput) => Promise<void>;
};

type Computed =
  | { shares: Record<string, number>; basisPoints?: Record<string, number>; problem?: undefined }
  | { shares?: undefined; basisPoints?: undefined; problem: string };

function mapValues<T, U>(record: Record<string, T>, fn: (value: T) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fn(value)]));
}

export function ExpenseForm({ group, me, initial, submitLabel, onSubmit }: Props) {
  const { currency } = group;
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amountText, setAmountText] = useState(
    initial ? amountToInput(initial.amount, currency) : "",
  );
  const [date, setDate] = useState(initial?.date ?? today());
  const [selected, setSelected] = useState(
    () => new Set(initial?.participantIds ?? group.memberIds),
  );
  const [splitType, setSplitType] = useState<SplitType>(initial?.splitType ?? "equal");
  const [fixedTexts, setFixedTexts] = useState<Record<string, string>>(() =>
    initial?.splitType === "fixed"
      ? mapValues(initial.shares, (share) => amountToInput(share, currency))
      : {},
  );
  const [percentTexts, setPercentTexts] = useState<Record<string, string>>(() =>
    initial?.percentages ? mapValues(initial.percentages, percentToInput) : {},
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const money = (minor: number) => formatMoney(minor, currency);
  const nameOf = (id: string) => memberName(group, id, me);
  const participantIds = group.memberIds.filter((id) => selected.has(id));
  const amount = parseAmount(amountText, currency);
  const computed = computeShares();

  function computeShares(): Computed {
    if (amount === null || amount === 0) {
      return { problem: amountText.trim() ? "Enter a valid amount." : "Enter the amount you paid." };
    }
    if (participantIds.length === 0) return { problem: "Select at least one person." };

    if (splitType === "equal") {
      // Payer first, so they absorb any leftover paisa from rounding.
      const payerFirst = [...participantIds].sort((a, b) => Number(b === me) - Number(a === me));
      return { shares: splitEqually(amount, payerFirst) };
    }

    if (splitType === "fixed") {
      const shares: Record<string, number> = {};
      for (const id of participantIds) {
        const share = parseAmount(fixedTexts[id] || "0", currency);
        if (share === null) return { problem: `Check the amount for ${nameOf(id)}.` };
        shares[id] = share;
      }
      const assigned = sum(Object.values(shares));
      if (assigned < amount) return { problem: `${money(amount - assigned)} left to assign.` };
      if (assigned > amount) return { problem: `${money(assigned - amount)} more than the total.` };
      return { shares };
    }

    const basisPoints: Record<string, number> = {};
    for (const id of participantIds) {
      const value = parsePercent(percentTexts[id] || "0");
      if (value === null) return { problem: `Check the percentage for ${nameOf(id)}.` };
      basisPoints[id] = value;
    }
    const total = sum(Object.values(basisPoints));
    if (total !== 10000) {
      return { problem: `Percentages add up to ${total / 100}%. They need to total 100%.` };
    }
    return { shares: splitByPercentage(amount, basisPoints), basisPoints };
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allSelected = participantIds.length === group.memberIds.length;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!computed.shares || amount === null || !description.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        description: description.trim(),
        amount,
        date,
        splitType,
        participantIds,
        shares: computed.shares,
        percentages: computed.basisPoints,
      });
      // The page navigates away on success, so `saving` stays true to block double submits.
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">What was it for?</span>
          <input
            className={`${inputClass} mt-1`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={100}
            placeholder="Dinner, cab, groceries…"
            required
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium">You paid ({currency})</span>
            <input
              className={`${inputClass} mt-1`}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Date</span>
            <input
              type="date"
              className={`${inputClass} mt-1`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <span className="text-sm font-medium">Split</span>
          <div
            role="radiogroup"
            aria-label="How to split"
            className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800"
          >
            {SPLIT_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                role="radio"
                aria-checked={splitType === type.value}
                onClick={() => setSplitType(type.value)}
                className={`rounded-md px-2 py-1.5 text-xs font-medium sm:text-sm ${
                  splitType === type.value
                    ? "bg-white shadow-sm dark:bg-zinc-950"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Between</span>
            <button
              type="button"
              onClick={() => setSelected(new Set(allSelected ? [] : group.memberIds))}
              className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>
          <ul className="mt-1 divide-y divide-zinc-100 dark:divide-zinc-800">
            {group.memberIds.map((id) => {
              const isSelected = selected.has(id);
              const share = computed.shares?.[id];
              return (
                <li key={id} className="flex min-h-12 items-center gap-3 py-2">
                  <input
                    id={`member-${id}`}
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(id)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <label htmlFor={`member-${id}`} className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <MemberAvatar group={group} uid={id} />
                    <span className="truncate">{nameOf(id)}</span>
                  </label>

                  {isSelected && splitType === "equal" && (
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {share !== undefined ? money(share) : "–"}
                    </span>
                  )}
                  {isSelected && splitType === "fixed" && (
                    <input
                      aria-label={`Amount for ${nameOf(id)}`}
                      className={`${inputBaseClass} w-28 text-right`}
                      value={fixedTexts[id] ?? ""}
                      onChange={(e) => setFixedTexts({ ...fixedTexts, [id]: e.target.value })}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  )}
                  {isSelected && splitType === "percentage" && (
                    <div className="flex items-center gap-2">
                      {share !== undefined && (
                        <span className="text-xs text-zinc-500">{money(share)}</span>
                      )}
                      <input
                        aria-label={`Percentage for ${nameOf(id)}`}
                        className={`${inputBaseClass} w-20 text-right`}
                        value={percentTexts[id] ?? ""}
                        onChange={(e) => setPercentTexts({ ...percentTexts, [id]: e.target.value })}
                        inputMode="decimal"
                        placeholder="0"
                      />
                      <span className="text-sm text-zinc-500">%</span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <p
          className={`text-sm ${
            computed.problem ? "text-amber-800 dark:text-amber-300" : "text-zinc-500"
          }`}
        >
          {computed.problem ??
            `Split between ${participantIds.length} ${participantIds.length === 1 ? "person" : "people"}.`}
        </p>
      </Card>

      {error && <ErrorText>{error}</ErrorText>}
      <button
        type="submit"
        disabled={saving || Boolean(computed.problem) || !description.trim()}
        className={`${buttonClass("primary")} w-full`}
      >
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

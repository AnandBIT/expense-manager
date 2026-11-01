"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignedInUser } from "@/components/AuthProvider";
import { BackLink, Card, ErrorText, buttonClass, errorMessage, inputClass } from "@/components/ui";
import { createGroup } from "@/lib/groups";
import { CURRENCIES } from "@/lib/money";

export default function NewGroupPage() {
  const user = useSignedInUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currencyNames = new Intl.DisplayNames(undefined, { type: "currency" });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const groupId = await createGroup(user, name.trim(), currency);
      router.replace(`/groups/${groupId}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <BackLink href="/dashboard">All groups</BackLink>
      <h1 className="text-xl font-semibold">New group</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Group name</span>
            <input
              className={`${inputClass} mt-1`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Goa trip, Flat 4B, Office lunch…"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Currency</span>
            <select
              className={`${inputClass} mt-1`}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code} · {currencyNames.of(code)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-zinc-500">
              All expenses in this group use this currency. It can&apos;t be changed later.
            </span>
          </label>
        </Card>

        {error && <ErrorText>{error}</ErrorText>}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className={`${buttonClass("primary")} w-full`}
        >
          {saving ? "Creating…" : "Create group"}
        </button>
      </form>
    </div>
  );
}

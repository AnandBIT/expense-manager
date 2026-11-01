import type { Timestamp } from "firebase/firestore";

// All money is stored as an integer number of minor units (paise, cents) so
// totals never drift from floating-point rounding.

export type Member = {
  name: string;
  photoURL: string;
  // The invite code used to join; firestore.rules checks it on join.
  joinedWith?: string;
};

export type Group = {
  id: string;
  name: string;
  currency: string;
  createdBy: string;
  // null while a serverTimestamp() write is still pending locally.
  createdAt: Timestamp | null;
  memberIds: string[];
  members: Record<string, Member>;
  inviteCode: string;
};

export type SplitType = "equal" | "fixed" | "percentage";

export type Expense = {
  id: string;
  description: string;
  amount: number;
  // Always the person who added the expense.
  paidBy: string;
  splitType: SplitType;
  // Everyone sharing the cost. May or may not include the payer.
  participantIds: string[];
  // Each participant's share; adds up to `amount`.
  shares: Record<string, number>;
  // Basis points (1% = 100) per participant, kept for percentage splits only.
  percentages?: Record<string, number>;
  // YYYY-MM-DD, the day the money was spent.
  date: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  // Participants who said "I've paid" and are waiting for the payer to confirm.
  paidMarks: Record<string, Timestamp | null>;
  // Participants whose payment the payer confirmed. Final once set.
  settled: Record<string, Timestamp | null>;
};

export type ExpenseInput = Pick<
  Expense,
  "description" | "amount" | "splitType" | "participantIds" | "shares" | "percentages" | "date"
>;

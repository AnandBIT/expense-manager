import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Expense, ExpenseInput } from "./types";

function expensesOf(groupId: string) {
  return collection(db(), "groups", groupId, "expenses");
}

function expenseRef(groupId: string, expenseId: string) {
  return doc(db(), "groups", groupId, "expenses", expenseId);
}

// Newest first by the day it was spent, then by when it was added.
function newestFirst(a: Expense, b: Expense): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.createdAt?.toMillis() ?? Infinity) - (a.createdAt?.toMillis() ?? Infinity);
}

export function watchExpenses(
  groupId: string,
  onChange: (expenses: Expense[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    expensesOf(groupId),
    (snapshot) => {
      const expenses = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
      onChange(expenses.sort(newestFirst));
    },
    onError,
  );
}

export function watchExpense(
  groupId: string,
  expenseId: string,
  onChange: (expense: Expense | null) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    expenseRef(groupId, expenseId),
    (snapshot) =>
      onChange(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Expense) : null),
    onError,
  );
}

// Firestore rejects `undefined`, so optional fields are left out instead.
function fieldsOf(input: ExpenseInput) {
  const { percentages, ...rest } = input;
  return percentages ? { ...rest, percentages } : rest;
}

export async function createExpense(
  groupId: string,
  payerId: string,
  input: ExpenseInput,
): Promise<string> {
  const ref = await addDoc(expensesOf(groupId), {
    ...fieldsOf(input),
    paidBy: payerId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    paidMarks: {},
    settled: {},
  });
  return ref.id;
}

// Only allowed while no payment is settled. Clears pending "I've paid" marks,
// since the amounts people marked as paid may have changed.
export async function updateExpense(
  groupId: string,
  expenseId: string,
  input: ExpenseInput,
): Promise<void> {
  await updateDoc(expenseRef(groupId, expenseId), {
    ...input,
    percentages: input.percentages ?? deleteField(),
    updatedAt: serverTimestamp(),
    paidMarks: {},
    settled: {},
  });
}

export async function deleteExpense(groupId: string, expenseId: string): Promise<void> {
  await deleteDoc(expenseRef(groupId, expenseId));
}

// Debtor: "I've paid" → shows as pending verification from the payer.
export async function markPaid(groupId: string, expenseId: string, debtorId: string) {
  await updateDoc(expenseRef(groupId, expenseId), {
    [`paidMarks.${debtorId}`]: serverTimestamp(),
  });
}

// Debtor takes back "I've paid", or payer says "Not received".
export async function clearPaidMark(groupId: string, expenseId: string, debtorId: string) {
  await updateDoc(expenseRef(groupId, expenseId), {
    [`paidMarks.${debtorId}`]: deleteField(),
  });
}

// Payer: "Received" → that share is settled for good.
export async function confirmReceived(groupId: string, expenseId: string, debtorId: string) {
  await updateDoc(expenseRef(groupId, expenseId), {
    [`settled.${debtorId}`]: serverTimestamp(),
  });
}

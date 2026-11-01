import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { newestFirst } from "./expenseList";
import { db } from "./firebase";
import type { Expense, ExpenseInput } from "./types";

function expensesOf(groupId: string) {
  return collection(db(), "groups", groupId, "expenses");
}

function expenseRef(groupId: string, expenseId: string) {
  return doc(db(), "groups", groupId, "expenses", expenseId);
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
  const { percentages, notes, ...rest } = input;
  return { ...rest, ...(percentages ? { percentages } : {}), ...(notes ? { notes } : {}) };
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
    notes: input.notes ?? deleteField(),
    updatedAt: serverTimestamp(),
    paidMarks: {},
    settled: {},
  });
}

export async function deleteExpense(groupId: string, expenseId: string): Promise<void> {
  await deleteDoc(expenseRef(groupId, expenseId));
}

// Every expense in the group, a page at a time, until the server has none
// left. Only allowed once everyone has approved deleting the group. Batches of
// 10: each delete's rule reads the group, and rules allow 20 reads per batch.
export async function deleteAllExpenses(groupId: string): Promise<void> {
  for (;;) {
    const page = await getDocsFromServer(query(expensesOf(groupId), limit(200)));
    if (page.empty) return;
    const commits = [];
    for (let i = 0; i < page.docs.length; i += 10) {
      const batch = writeBatch(db());
      for (const expense of page.docs.slice(i, i + 10)) batch.delete(expense.ref);
      commits.push(batch.commit());
    }
    await Promise.all(commits);
  }
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

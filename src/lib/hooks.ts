import { useEffect, useState } from "react";
import { watchExpense, watchExpenses } from "./expenses";
import { watchGroup, watchMyGroups } from "./groups";
import type { Expense, Group } from "./types";

// Each hook returns { data: undefined } while loading, then data or an error.
type Live<T> = { data?: T; error?: Error };

export function useMyGroups(uid: string): Live<Group[]> {
  const [state, setState] = useState<Live<Group[]>>({});
  useEffect(
    () => watchMyGroups(uid, (data) => setState({ data }), (error) => setState({ error })),
    [uid],
  );
  return state;
}

export function useGroup(groupId: string): Live<Group> {
  const [state, setState] = useState<Live<Group>>({});
  useEffect(
    () => watchGroup(groupId, (data) => setState({ data }), (error) => setState({ error })),
    [groupId],
  );
  return state;
}

export function useExpenses(groupId: string): Live<Expense[]> {
  const [state, setState] = useState<Live<Expense[]>>({});
  useEffect(
    () => watchExpenses(groupId, (data) => setState({ data }), (error) => setState({ error })),
    [groupId],
  );
  return state;
}

export function useExpense(groupId: string, expenseId: string): Live<Expense | null> {
  const [state, setState] = useState<Live<Expense | null>>({});
  useEffect(
    () =>
      watchExpense(
        groupId,
        expenseId,
        (data) => setState({ data }),
        (error) => setState({ error }),
      ),
    [groupId, expenseId],
  );
  return state;
}

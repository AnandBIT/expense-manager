import type { User } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { deleteAllExpenses } from "./expenses";
import { db } from "./firebase";
import type { Group, Member } from "./types";

export type Invite = { groupId: string; groupName: string };

function groupRef(groupId: string) {
  return doc(db(), "groups", groupId);
}

function inviteRef(code: string) {
  return doc(db(), "invites", code);
}

function memberFrom(user: User): Member {
  return {
    name: user.displayName || user.email || "Member",
    photoURL: user.photoURL ?? "",
  };
}

// People who left keep their name on old expenses, marked as gone.
export function memberName(group: Group, uid: string, me: string): string {
  if (uid === me) return "You";
  const member = group.members[uid];
  if (!member) return "Unknown member";
  return group.memberIds.includes(uid) ? member.name : `${member.name} (left)`;
}

// True once every current member has approved deleting the group.
export function isDeletionApproved(group: Group): boolean {
  const { deletion } = group;
  return deletion !== undefined && group.memberIds.every((id) => deletion.approvedBy.includes(id));
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Creates the group and its invite link together, so neither can exist alone.
export async function createGroup(user: User, name: string, currency: string): Promise<string> {
  const ref = doc(collection(db(), "groups"));
  const inviteCode = randomCode();

  const batch = writeBatch(db());
  batch.set(ref, {
    name,
    currency,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    memberIds: [user.uid],
    members: { [user.uid]: memberFrom(user) },
    inviteCode,
  });
  batch.set(inviteRef(inviteCode), { groupId: ref.id, groupName: name });
  await batch.commit();

  return ref.id;
}

export function watchMyGroups(
  uid: string,
  onChange: (groups: Group[]) => void,
  onError: (error: Error) => void,
): () => void {
  const myGroups = query(collection(db(), "groups"), where("memberIds", "array-contains", uid));
  return onSnapshot(
    myGroups,
    (snapshot) => {
      const groups = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Group);
      onChange(groups.sort((a, b) => a.name.localeCompare(b.name)));
    },
    onError,
  );
}

export function watchGroup(
  groupId: string,
  onChange: (group: Group) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    groupRef(groupId),
    (snapshot) => {
      // For example, deleted while someone has it open.
      if (snapshot.exists()) onChange({ id: snapshot.id, ...snapshot.data() } as Group);
      else onError(new Error("This group doesn't exist."));
    },
    onError,
  );
}

export async function getInvite(code: string): Promise<Invite | null> {
  const snapshot = await getDoc(inviteRef(code));
  return snapshot.exists() ? (snapshot.data() as Invite) : null;
}

// Non-members aren't allowed to read a group, so a denied read means "not a member".
export async function isGroupMember(groupId: string): Promise<boolean> {
  try {
    await getDoc(groupRef(groupId));
    return true;
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "permission-denied") return false;
    throw error;
  }
}

export async function joinGroup(user: User, groupId: string, inviteCode: string): Promise<void> {
  await updateDoc(groupRef(groupId), {
    memberIds: arrayUnion(user.uid),
    [`members.${user.uid}`]: { ...memberFrom(user), joinedWith: inviteCode },
  });
}

export function inviteUrl(group: Group): string {
  return `${window.location.origin}/join/${group.inviteCode}`;
}

// ---------- managing a group (any member can) ----------

// The invite keeps a copy of the name for the join page.
export async function renameGroup(group: Group, name: string): Promise<void> {
  const batch = writeBatch(db());
  batch.update(groupRef(group.id), { name });
  batch.set(inviteRef(group.inviteCode), { groupId: group.id, groupName: name });
  await batch.commit();
}

// Moves the group to a new invite code, along with `changes`. The old link
// stops working straight away.
async function rotateInvite(group: Group, changes: Record<string, unknown> = {}): Promise<void> {
  const code = randomCode();
  const batch = writeBatch(db());
  batch.update(groupRef(group.id), { ...changes, inviteCode: code });
  batch.delete(inviteRef(group.inviteCode));
  batch.set(inviteRef(code), { groupId: group.id, groupName: group.name });
  await batch.commit();
}

export async function resetInviteLink(group: Group): Promise<void> {
  await rotateInvite(group);
}

// Also resets the invite link, so they can't rejoin with the one they have, and
// drops any open deletion request, since they hadn't voted on it.
export async function removeMember(group: Group, uid: string): Promise<void> {
  await rotateInvite(group, { memberIds: arrayRemove(uid), deletion: deleteField() });
}

export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  await updateDoc(groupRef(groupId), { memberIds: arrayRemove(uid) });
}

// ---------- deleting a group (everyone approves) ----------

// Asking counts as your own approval.
export async function requestDeletion(groupId: string, uid: string): Promise<void> {
  await updateDoc(groupRef(groupId), {
    deletion: { requestedBy: uid, requestedAt: serverTimestamp(), approvedBy: [uid] },
  });
}

export async function approveDeletion(groupId: string, uid: string): Promise<void> {
  await updateDoc(groupRef(groupId), { "deletion.approvedBy": arrayUnion(uid) });
}

// Rejecting and withdrawing both drop the request. Not allowed once everyone has approved.
export async function cancelDeletion(groupId: string): Promise<void> {
  await updateDoc(groupRef(groupId), { deletion: deleteField() });
}

// Once everyone has approved. Firestore doesn't delete subcollections, so the
// expenses go first, then the invite and the group together. Safe to run
// again if it gets interrupted.
export async function finishDeletion(groupId: string): Promise<void> {
  const snapshot = await getDocFromServer(groupRef(groupId)).catch((error: unknown) => {
    // A group that no longer exists can't be read: someone else (or an earlier
    // try) has already finished deleting it.
    if (error instanceof FirebaseError && error.code === "permission-denied") return null;
    throw error;
  });
  if (!snapshot) return;
  const group = { id: snapshot.id, ...snapshot.data() } as Group;
  if (!isDeletionApproved(group)) throw new Error("Not everyone has approved deleting this group yet.");

  await deleteAllExpenses(groupId);
  const batch = writeBatch(db());
  batch.delete(inviteRef(group.inviteCode));
  batch.delete(groupRef(groupId));
  await batch.commit();
}

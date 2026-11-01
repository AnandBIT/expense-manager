import type { User } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Group, Member } from "./types";

export type Invite = { groupId: string; groupName: string };

function memberFrom(user: User): Member {
  return {
    name: user.displayName || user.email || "Member",
    photoURL: user.photoURL ?? "",
  };
}

export function memberName(group: Group, uid: string, me: string): string {
  if (uid === me) return "You";
  return group.members[uid]?.name ?? "Unknown member";
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Creates the group and its invite link together, so neither can exist alone.
export async function createGroup(user: User, name: string, currency: string): Promise<string> {
  const groupRef = doc(collection(db(), "groups"));
  const inviteCode = randomCode();

  const batch = writeBatch(db());
  batch.set(groupRef, {
    name,
    currency,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    memberIds: [user.uid],
    members: { [user.uid]: memberFrom(user) },
    inviteCode,
  });
  batch.set(doc(db(), "invites", inviteCode), { groupId: groupRef.id, groupName: name });
  await batch.commit();

  return groupRef.id;
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
    doc(db(), "groups", groupId),
    (snapshot) => onChange({ id: snapshot.id, ...snapshot.data() } as Group),
    onError,
  );
}

export async function getInvite(code: string): Promise<Invite | null> {
  const snapshot = await getDoc(doc(db(), "invites", code));
  return snapshot.exists() ? (snapshot.data() as Invite) : null;
}

// Non-members aren't allowed to read a group, so a denied read means "not a member".
export async function isGroupMember(groupId: string): Promise<boolean> {
  try {
    await getDoc(doc(db(), "groups", groupId));
    return true;
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "permission-denied") return false;
    throw error;
  }
}

export async function joinGroup(user: User, groupId: string, inviteCode: string): Promise<void> {
  await updateDoc(doc(db(), "groups", groupId), {
    memberIds: arrayUnion(user.uid),
    [`members.${user.uid}`]: { ...memberFrom(user), joinedWith: inviteCode },
  });
}

export function inviteUrl(group: Group): string {
  return `${window.location.origin}/join/${group.inviteCode}`;
}

import type { User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Creates users/{uid} on first sign-in and refreshes name/photo on later ones.
export async function saveUserProfile(user: User): Promise<void> {
  const ref = doc(db(), "users", user.uid);
  const existing = await getDoc(ref);

  const profile = {
    displayName: user.displayName || user.email || "Unnamed user",
    email: user.email ?? "",
    photoURL: user.photoURL ?? "",
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(
    ref,
    existing.exists() ? profile : { ...profile, createdAt: serverTimestamp() },
    { merge: true },
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { useSignedInUser } from "@/components/AuthProvider";
import { Card, ErrorText, Loading, buttonClass, errorMessage } from "@/components/ui";
import { getInvite, isGroupMember, joinGroup, type Invite } from "@/lib/groups";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const user = useSignedInUser();
  const router = useRouter();
  // undefined while loading, null if the code doesn't match any group.
  const [invite, setInvite] = useState<Invite | null>();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getInvite(code);
        if (found && (await isGroupMember(found.groupId))) {
          router.replace(`/groups/${found.groupId}`);
          return;
        }
        if (!cancelled) setInvite(found);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  async function handleJoin() {
    if (!invite) return;
    setJoining(true);
    setError(null);
    try {
      await joinGroup(user, invite.groupId, code);
      router.replace(`/groups/${invite.groupId}`);
    } catch (err) {
      if (err instanceof FirebaseError && err.code === "permission-denied") {
        // Resetting the link (or removing someone) retires this code; otherwise
        // the rules turn joins down while a group is full or about to be deleted.
        const linkStillWorks = await getInvite(code).then(Boolean, () => true);
        setError(
          linkStillWorks
            ? "This group can't take new members right now. Ask whoever sent you the link."
            : "This invite link has expired. Ask whoever sent it for the new one.",
        );
      } else {
        setError(errorMessage(err));
      }
      setJoining(false);
    }
  }

  if (error && invite === undefined) return <ErrorText>{error}</ErrorText>;
  if (invite === undefined) return <Loading />;

  return (
    <Card className="mx-auto max-w-sm space-y-4 text-center">
      {invite === null ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This invite link isn&apos;t valid. Ask whoever sent it for a new one.
        </p>
      ) : (
        <>
          <div>
            <p className="text-sm text-zinc-500">You&apos;ve been invited to join</p>
            <h1 className="mt-1 text-xl font-semibold">{invite.groupName}</h1>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className={`${buttonClass("primary")} w-full`}
          >
            {joining ? "Joining…" : "Join group"}
          </button>
        </>
      )}
    </Card>
  );
}

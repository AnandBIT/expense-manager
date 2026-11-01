// Runs against the Firestore emulator: yarn test:rules
// Each write below mirrors what the app sends from src/lib/*.ts.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const INVITE = "0123456789abcdef0123456789abcdef";
const INVITE2 = "fedcba9876543210fedcba9876543210";
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-expense-manager",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

function as(uid: string) {
  return env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
}

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), path), data));
}

// Group "g1" with alice, bob and carol (alice created it).
async function seedGroup(memberIds = ["alice", "bob", "carol"], extra: Record<string, unknown> = {}) {
  await seed("groups/g1", {
    name: "Trip",
    currency: "INR",
    createdBy: "alice",
    createdAt: Timestamp.now(),
    memberIds,
    members: Object.fromEntries(memberIds.map((id) => [id, { name: id, photoURL: "" }])),
    inviteCode: INVITE,
    ...extra,
  });
  await seed(`invites/${INVITE}`, { groupId: "g1", groupName: "Trip" });
}

// A deletion request alice made, approved so far by `approvedBy`.
function deletion(approvedBy: string[]) {
  return { requestedBy: "alice", requestedAt: Timestamp.now(), approvedBy };
}

const groupDoc = (uid: string) => doc(as(uid), "groups/g1");

// What joinGroup() sends.
function join(uid: string, code = INVITE) {
  return updateDoc(groupDoc(uid), {
    memberIds: arrayUnion(uid),
    [`members.${uid}`]: { name: uid, photoURL: "", joinedWith: code },
  });
}

// What resetInviteLink() sends (and removeMember(), with its extra group
// changes): the group moves to INVITE2, the old invite goes, a new one appears.
function rotateInvite(uid: string, groupChanges: Record<string, unknown> = {}) {
  const db = as(uid);
  const batch = writeBatch(db);
  batch.update(doc(db, "groups/g1"), { ...groupChanges, inviteCode: INVITE2 });
  batch.delete(doc(db, `invites/${INVITE}`));
  batch.set(doc(db, `invites/${INVITE2}`), { groupId: "g1", groupName: "Trip" });
  return batch.commit();
}

// The last batch of finishDeletion(): the invite and the group together.
function deleteGroupAndInvite(uid: string) {
  const db = as(uid);
  const batch = writeBatch(db);
  batch.delete(doc(db, `invites/${INVITE}`));
  batch.delete(doc(db, "groups/g1"));
  return batch.commit();
}

// Alice paid ₹300 for alice, bob and carol: bob and carol owe her ₹100 each.
function newExpense(overrides: Record<string, unknown> = {}) {
  return {
    description: "Dinner",
    amount: 30000,
    paidBy: "alice",
    splitType: "equal",
    participantIds: ["alice", "bob", "carol"],
    shares: { alice: 10000, bob: 10000, carol: 10000 },
    date: "2026-10-04",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    paidMarks: {},
    settled: {},
    ...overrides,
  };
}

async function seedExpense(overrides: Record<string, unknown> = {}) {
  await seed("groups/g1/expenses/e1", {
    ...newExpense(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  });
}

// What updateExpense() sends.
function edit(overrides: Record<string, unknown> = {}) {
  return {
    description: "Dinner (edited)",
    amount: 30000,
    splitType: "equal",
    participantIds: ["alice", "bob", "carol"],
    shares: { alice: 10000, bob: 10000, carol: 10000 },
    date: "2026-10-04",
    percentages: deleteField(),
    updatedAt: serverTimestamp(),
    paidMarks: {},
    settled: {},
    ...overrides,
  };
}

const expenseDoc = (uid: string) => doc(as(uid), "groups/g1/expenses/e1");

describe("users", () => {
  const profile = {
    displayName: "Alice",
    email: "alice@example.com",
    photoURL: "",
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  it("lets you create and read your own profile", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice"), profile));
    await assertSucceeds(getDoc(doc(as("alice"), "users/alice")));
  });

  it("blocks reading or writing anyone else's profile", async () => {
    await seed("users/alice", { ...profile, createdAt: Timestamp.now(), lastLoginAt: Timestamp.now() });
    await assertFails(getDoc(doc(as("bob"), "users/alice")));
    await assertFails(setDoc(doc(as("bob"), "users/alice"), profile));
  });

  it("blocks signed-out visitors", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "users/alice")));
  });
});

describe("groups", () => {
  it("lets you create a group with its invite in one batch", async () => {
    const db = as("alice");
    const batch = writeBatch(db);
    batch.set(doc(db, "groups/new"), {
      name: "Flat",
      currency: "INR",
      createdBy: "alice",
      createdAt: serverTimestamp(),
      memberIds: ["alice"],
      members: { alice: { name: "Alice", photoURL: "" } },
      inviteCode: INVITE,
    });
    batch.set(doc(db, `invites/${INVITE}`), { groupId: "new", groupName: "Flat" });
    await assertSucceeds(batch.commit());
  });

  it("blocks creating a group that already includes other people", async () => {
    await assertFails(
      setDoc(doc(as("alice"), "groups/new"), {
        name: "Flat",
        currency: "INR",
        createdBy: "alice",
        createdAt: serverTimestamp(),
        memberIds: ["alice", "bob"],
        members: { alice: { name: "Alice", photoURL: "" }, bob: { name: "Bob", photoURL: "" } },
        inviteCode: INVITE,
      }),
    );
  });

  it("only lets members see a group", async () => {
    await seedGroup();
    await assertSucceeds(getDoc(doc(as("bob"), "groups/g1")));
    await assertSucceeds(
      getDocs(query(collection(as("bob"), "groups"), where("memberIds", "array-contains", "bob"))),
    );
    await assertFails(getDoc(doc(as("mallory"), "groups/g1")));
  });

  it("lets anyone signed in open an invite by its code, but not list invites", async () => {
    await seedGroup();
    await assertSucceeds(getDoc(doc(as("dave"), `invites/${INVITE}`)));
    await assertFails(getDocs(collection(as("dave"), "invites")));
  });

  it("lets you join with the right invite code", async () => {
    await seedGroup();
    await assertSucceeds(
      updateDoc(doc(as("dave"), "groups/g1"), {
        memberIds: arrayUnion("dave"),
        "members.dave": { name: "Dave", photoURL: "", joinedWith: INVITE },
      }),
    );
  });

  it("blocks joining with a wrong code", async () => {
    await seedGroup();
    await assertFails(
      updateDoc(doc(as("dave"), "groups/g1"), {
        memberIds: arrayUnion("dave"),
        "members.dave": { name: "Dave", photoURL: "", joinedWith: "guessed-code-0000" },
      }),
    );
  });

  it("blocks adding someone other than yourself", async () => {
    await seedGroup();
    await assertFails(
      updateDoc(doc(as("dave"), "groups/g1"), {
        memberIds: arrayUnion("erin"),
        "members.erin": { name: "Erin", photoURL: "", joinedWith: INVITE },
      }),
    );
  });

  it("blocks other changes to a group", async () => {
    await seedGroup();
    await assertFails(updateDoc(groupDoc("bob"), { currency: "USD" }));
    await assertFails(updateDoc(groupDoc("bob"), { createdBy: "bob" }));
    await assertFails(updateDoc(groupDoc("alice"), { memberIds: ["alice"] }));
  });
});

describe("leaving a group", () => {
  beforeEach(() => seedGroup());

  it("lets a member leave, keeping their name for old expenses", async () => {
    await assertSucceeds(updateDoc(groupDoc("bob"), { memberIds: arrayRemove("bob") }));
    await assertFails(getDoc(groupDoc("bob")));
    await assertFails(getDoc(doc(as("bob"), "groups/g1/expenses/e1")));
    const group = await getDoc(groupDoc("alice"));
    expect(group.data()?.memberIds).toEqual(["alice", "carol"]);
    expect(group.data()?.members.bob.name).toBe("bob");
  });

  it("doesn't let the last member leave", async () => {
    await seedGroup(["alice"]);
    await assertFails(updateDoc(groupDoc("alice"), { memberIds: arrayRemove("alice") }));
  });

  it("blocks changing anything else while leaving", async () => {
    await assertFails(
      updateDoc(groupDoc("bob"), { memberIds: arrayRemove("bob"), "members.bob": deleteField() }),
    );
    await assertFails(updateDoc(groupDoc("bob"), { memberIds: arrayRemove("bob"), name: "Mine" }));
  });

  it("lets people who left rejoin with the invite link", async () => {
    await updateDoc(groupDoc("bob"), { memberIds: arrayRemove("bob") });
    await assertSucceeds(join("bob"));
  });
});

describe("removing a member", () => {
  beforeEach(() => seedGroup());

  it("lets any member remove another, resetting the invite so they can't rejoin with it", async () => {
    await assertSucceeds(
      rotateInvite("bob", { memberIds: arrayRemove("carol"), deletion: deleteField() }),
    );
    await assertFails(getDoc(groupDoc("carol")));
    await assertFails(join("carol", INVITE));
    await assertSucceeds(join("carol", INVITE2));
  });

  it("needs the invite reset in the same write", async () => {
    await assertFails(updateDoc(groupDoc("alice"), { memberIds: arrayRemove("carol") }));
  });

  it("removes exactly one person, by a member who stays", async () => {
    await assertFails(rotateInvite("alice", { memberIds: ["alice"] }));
    await assertFails(rotateInvite("alice", { memberIds: ["alice", "bob", "mallory"] }));
    await assertFails(rotateInvite("mallory", { memberIds: arrayRemove("carol") }));
  });

  it("drops a pending deletion request, and is blocked once everyone has approved", async () => {
    await seedGroup(["alice", "bob", "carol"], { deletion: deletion(["alice", "bob"]) });
    await assertFails(rotateInvite("alice", { memberIds: arrayRemove("carol") }));
    await assertSucceeds(
      rotateInvite("alice", { memberIds: arrayRemove("carol"), deletion: deleteField() }),
    );

    await seedGroup(["alice", "bob", "carol"], { deletion: deletion(["alice", "bob", "carol"]) });
    await assertFails(
      rotateInvite("alice", { memberIds: arrayRemove("carol"), deletion: deleteField() }),
    );
  });
});

describe("renaming a group", () => {
  beforeEach(() => seedGroup());

  // What renameGroup() sends.
  function rename(uid: string, name: string, inviteName = name) {
    const db = as(uid);
    const batch = writeBatch(db);
    batch.update(doc(db, "groups/g1"), { name });
    batch.set(doc(db, `invites/${INVITE}`), { groupId: "g1", groupName: inviteName });
    return batch.commit();
  }

  it("lets any member rename the group, updating its invite too", async () => {
    await assertSucceeds(rename("bob", "Goa trip"));
    const invite = await getDoc(doc(as("dave"), `invites/${INVITE}`));
    expect(invite.data()?.groupName).toBe("Goa trip");
  });

  it("keeps the invite's copy of the name in step", async () => {
    await assertFails(updateDoc(groupDoc("bob"), { name: "Goa trip" }));
    await assertFails(rename("bob", "Goa trip", "Something else"));
  });

  it("checks the name and who's renaming", async () => {
    await assertFails(rename("bob", ""));
    await assertFails(rename("bob", "x".repeat(61)));
    await assertFails(rename("mallory", "Hacked"));
  });
});

describe("resetting the invite link", () => {
  beforeEach(() => seedGroup());

  it("stops the old link working and starts a new one", async () => {
    await assertSucceeds(rotateInvite("bob"));
    expect((await getDoc(doc(as("dave"), `invites/${INVITE}`))).exists()).toBe(false);
    await assertFails(join("dave", INVITE));
    await assertSucceeds(join("dave", INVITE2));
  });

  it("must retire the old invite and create the new one in the same write", async () => {
    await assertFails(updateDoc(groupDoc("bob"), { inviteCode: INVITE2 }));

    const db = as("bob");
    const keepsOldInvite = writeBatch(db);
    keepsOldInvite.update(doc(db, "groups/g1"), { inviteCode: INVITE2 });
    keepsOldInvite.set(doc(db, `invites/${INVITE2}`), { groupId: "g1", groupName: "Trip" });
    await assertFails(keepsOldInvite.commit());
  });

  it("blocks deleting the current invite or making another one", async () => {
    await assertFails(deleteDoc(doc(as("bob"), `invites/${INVITE}`)));
    await assertFails(
      setDoc(doc(as("bob"), `invites/${INVITE2}`), { groupId: "g1", groupName: "Trip" }),
    );
    await assertFails(rotateInvite("mallory"));
  });
});

describe("deleting a group", () => {
  // What requestDeletion() and approveDeletion() send.
  const ask = (uid: string) =>
    updateDoc(groupDoc(uid), {
      deletion: { requestedBy: uid, requestedAt: serverTimestamp(), approvedBy: [uid] },
    });
  const approve = (uid: string) =>
    updateDoc(groupDoc(uid), { "deletion.approvedBy": arrayUnion(uid) });

  it("happens only once every member has approved", async () => {
    await seedGroup();
    await seedExpense();
    await assertSucceeds(ask("alice"));
    await assertFails(deleteGroupAndInvite("alice"));
    await assertSucceeds(approve("bob"));
    await assertFails(deleteGroupAndInvite("alice"));
    await assertSucceeds(approve("carol"));

    // Then any member deletes the expenses, then the invite and the group.
    await assertSucceeds(deleteDoc(doc(as("bob"), "groups/g1/expenses/e1")));
    await assertSucceeds(deleteGroupAndInvite("bob"));
  });

  it("only takes a request or approval for yourself", async () => {
    await seedGroup();
    await assertFails(
      updateDoc(groupDoc("alice"), {
        deletion: { requestedBy: "bob", requestedAt: serverTimestamp(), approvedBy: ["bob"] },
      }),
    );
    await assertFails(
      updateDoc(groupDoc("alice"), {
        deletion: { requestedBy: "alice", requestedAt: serverTimestamp(), approvedBy: ["alice", "bob"] },
      }),
    );
    await assertFails(ask("mallory"));

    await assertSucceeds(ask("alice"));
    await assertFails(ask("bob"));
    await assertFails(updateDoc(groupDoc("bob"), { "deletion.approvedBy": arrayUnion("carol") }));
    await assertFails(
      updateDoc(groupDoc("bob"), {
        "deletion.approvedBy": arrayUnion("bob"),
        "deletion.requestedBy": "bob",
      }),
    );
    await assertFails(approve("mallory"));
  });

  it("lets any member reject it until everyone has approved", async () => {
    await seedGroup(["alice", "bob", "carol"], { deletion: deletion(["alice"]) });
    await assertFails(updateDoc(groupDoc("mallory"), { deletion: deleteField() }));
    await assertSucceeds(updateDoc(groupDoc("carol"), { deletion: deleteField() }));

    await seedGroup(["alice", "bob", "carol"], { deletion: deletion(["alice", "bob", "carol"]) });
    await assertFails(updateDoc(groupDoc("carol"), { deletion: deleteField() }));
  });

  it("blocks joining while a deletion is pending", async () => {
    await seedGroup(["alice", "bob", "carol"], { deletion: deletion(["alice"]) });
    await assertFails(join("dave"));
  });

  it("freezes the expenses once everyone has approved", async () => {
    await seedGroup(["alice", "bob", "carol"], { deletion: deletion(["alice", "bob", "carol"]) });
    await seedExpense();
    await assertFails(addDoc(collection(as("alice"), "groups/g1/expenses"), newExpense()));
    await assertFails(updateDoc(expenseDoc("alice"), edit()));
    await assertFails(updateDoc(expenseDoc("bob"), { "paidMarks.bob": serverTimestamp() }));
    await assertFails(updateDoc(expenseDoc("alice"), { "settled.bob": serverTimestamp() }));
    await assertFails(deleteDoc(expenseDoc("mallory")));

    // Even a settled expense someone else paid for can now be deleted.
    await seedExpense({ settled: { carol: Timestamp.now() } });
    await assertSucceeds(deleteDoc(expenseDoc("bob")));
  });

  it("lets a member delete expenses in batches of 10, as finishDeletion does", async () => {
    await seedGroup(["alice", "bob", "carol"], { deletion: deletion(["alice", "bob", "carol"]) });
    for (let i = 0; i < 10; i++) await seed(`groups/g1/expenses/x${i}`, { ...newExpense(), createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    const db = as("bob");
    const batch = writeBatch(db);
    for (let i = 0; i < 10; i++) batch.delete(doc(db, `groups/g1/expenses/x${i}`));
    await assertSucceeds(batch.commit());
  });

  it("needs the invite deleted with the group, and can be retried", async () => {
    await seedGroup(["alice", "bob", "carol"], { deletion: deletion(["alice", "bob", "carol"]) });
    await assertFails(deleteDoc(groupDoc("bob")));
    await assertFails(deleteDoc(doc(as("bob"), `invites/${INVITE}`)));
    await assertFails(deleteGroupAndInvite("mallory"));
    await assertSucceeds(deleteGroupAndInvite("bob"));
    await assertSucceeds(deleteGroupAndInvite("bob"));
  });

  it("lets a sole member delete straight away", async () => {
    await seedGroup(["alice"]);
    await assertSucceeds(ask("alice"));
    await assertSucceeds(deleteGroupAndInvite("alice"));
  });

  it("doesn't let a payer delete a settled expense before then", async () => {
    await seedGroup(["alice", "bob", "carol"], { deletion: deletion(["alice"]) });
    await seedExpense({ settled: { bob: Timestamp.now() } });
    await assertFails(deleteDoc(expenseDoc("alice")));
  });
});

describe("former members", () => {
  it("can't be put on new expenses", async () => {
    await seedGroup(["alice", "bob"], {
      members: {
        alice: { name: "alice", photoURL: "" },
        bob: { name: "bob", photoURL: "" },
        carol: { name: "carol", photoURL: "" },
      },
    });
    await assertFails(addDoc(collection(as("alice"), "groups/g1/expenses"), newExpense()));
    await assertSucceeds(
      addDoc(
        collection(as("alice"), "groups/g1/expenses"),
        newExpense({ participantIds: ["alice", "bob"], shares: { alice: 15000, bob: 15000 } }),
      ),
    );
  });
});

describe("adding expenses", () => {
  beforeEach(() => seedGroup());

  it("lets a member add an expense they paid", async () => {
    await assertSucceeds(addDoc(collection(as("alice"), "groups/g1/expenses"), newExpense()));
  });

  it("blocks recording that someone else paid", async () => {
    await assertFails(addDoc(collection(as("bob"), "groups/g1/expenses"), newExpense()));
  });

  it("blocks non-members from adding or reading expenses", async () => {
    await seedExpense();
    await assertFails(
      addDoc(collection(as("mallory"), "groups/g1/expenses"), newExpense({ paidBy: "mallory" })),
    );
    await assertFails(getDoc(doc(as("mallory"), "groups/g1/expenses/e1")));
    await assertSucceeds(getDoc(doc(as("carol"), "groups/g1/expenses/e1")));
  });

  it("blocks splitting with someone outside the group", async () => {
    await assertFails(
      addDoc(
        collection(as("alice"), "groups/g1/expenses"),
        newExpense({
          participantIds: ["alice", "mallory"],
          shares: { alice: 15000, mallory: 15000 },
        }),
      ),
    );
  });

  it("takes an optional note of up to 500 characters", async () => {
    const expenses = collection(as("alice"), "groups/g1/expenses");
    await assertSucceeds(addDoc(expenses, newExpense({ notes: "Includes the tip" })));
    await assertFails(addDoc(expenses, newExpense({ notes: "x".repeat(501) })));
    await assertFails(addDoc(expenses, newExpense({ notes: 5 })));
  });

  it("blocks expenses that start out already paid or settled", async () => {
    await assertFails(
      addDoc(collection(as("alice"), "groups/g1/expenses"), newExpense({ settled: { bob: null } })),
    );
  });
});

describe("editing and deleting expenses", () => {
  beforeEach(async () => {
    await seedGroup();
    await seedExpense();
  });

  it("lets only the person who added it edit or delete it", async () => {
    await assertFails(updateDoc(expenseDoc("bob"), edit()));
    await assertFails(deleteDoc(expenseDoc("bob")));
    await assertSucceeds(updateDoc(expenseDoc("alice"), edit()));
    await assertSucceeds(deleteDoc(expenseDoc("alice")));
  });

  it("lets the payer add or clear a note when editing", async () => {
    await assertSucceeds(updateDoc(expenseDoc("alice"), edit({ notes: "Paid by card" })));
    await assertSucceeds(updateDoc(expenseDoc("alice"), edit({ notes: deleteField() })));
  });

  it("locks the expense once any payment is confirmed", async () => {
    await seedExpense({ settled: { bob: Timestamp.now() } });
    await assertFails(updateDoc(expenseDoc("alice"), edit()));
    await assertFails(deleteDoc(expenseDoc("alice")));
  });
});

describe("marking payments", () => {
  beforeEach(async () => {
    await seedGroup(["alice", "bob", "carol", "dave"]);
    await seedExpense();
  });

  it("lets bob mark his own share as paid, and undo it", async () => {
    await assertSucceeds(updateDoc(expenseDoc("bob"), { "paidMarks.bob": serverTimestamp() }));
    await assertSucceeds(updateDoc(expenseDoc("bob"), { "paidMarks.bob": deleteField() }));
  });

  it("blocks bob from marking carol's share", async () => {
    await assertFails(updateDoc(expenseDoc("bob"), { "paidMarks.carol": serverTimestamp() }));
  });

  it("blocks bob from settling his own debt", async () => {
    await assertFails(updateDoc(expenseDoc("bob"), { "settled.bob": serverTimestamp() }));
  });

  it("blocks a member who isn't part of the expense", async () => {
    await assertFails(updateDoc(expenseDoc("dave"), { "paidMarks.dave": serverTimestamp() }));
  });

  it("lets alice (the payer) confirm or reject bob's payment", async () => {
    await seedExpense({ paidMarks: { bob: Timestamp.now() } });
    await assertSucceeds(updateDoc(expenseDoc("alice"), { "paidMarks.bob": deleteField() }));
    await assertSucceeds(updateDoc(expenseDoc("alice"), { "settled.bob": serverTimestamp() }));
  });

  it("blocks anyone but the payer from confirming", async () => {
    await seedExpense({ paidMarks: { bob: Timestamp.now() } });
    await assertFails(updateDoc(expenseDoc("carol"), { "settled.bob": serverTimestamp() }));
  });

  it("makes a confirmed payment final", async () => {
    await seedExpense({ paidMarks: { bob: Timestamp.now() }, settled: { bob: Timestamp.now() } });
    await assertFails(updateDoc(expenseDoc("alice"), { "settled.bob": deleteField() }));
    await assertFails(updateDoc(expenseDoc("bob"), { "paidMarks.bob": deleteField() }));
  });

  it("blocks the payer from marking a debtor as having paid", async () => {
    await assertFails(updateDoc(expenseDoc("alice"), { "paidMarks.bob": serverTimestamp() }));
  });
});

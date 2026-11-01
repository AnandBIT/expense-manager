// Runs against the Firestore emulator: npm run test:rules
// Each write below mirrors what the app sends from src/lib/*.ts.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  Timestamp,
  addDoc,
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
async function seedGroup(memberIds = ["alice", "bob", "carol"]) {
  await seed("groups/g1", {
    name: "Trip",
    currency: "INR",
    createdBy: "alice",
    createdAt: Timestamp.now(),
    memberIds,
    members: Object.fromEntries(memberIds.map((id) => [id, { name: id, photoURL: "" }])),
    inviteCode: INVITE,
  });
  await seed(`invites/${INVITE}`, { groupId: "g1", groupName: "Trip" });
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

  it("blocks members from renaming the group or removing people", async () => {
    await seedGroup();
    await assertFails(updateDoc(doc(as("bob"), "groups/g1"), { name: "Hacked" }));
    await assertFails(updateDoc(doc(as("alice"), "groups/g1"), { memberIds: ["alice"] }));
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

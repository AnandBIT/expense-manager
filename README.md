# Expense Manager

Split group expenses and track who owes whom. Next.js frontend, Firebase Authentication (Google sign-in) and Cloud Firestore. There is no backend server: Firestore security rules in [`firestore.rules`](firestore.rules) decide who can read and write what.

## How it works

- Sign in with Google. Your profile is saved to `users/{uid}`.
- Create a group with a currency, then share its invite link. Anyone with the link can join after signing in.
- Add an expense you paid, with an optional note, pick who shares it, and split it **equally**, by **fixed amounts**, or by **percentages**.
- Each person sees net balances per person, e.g. "You have to pay ₹50 to Bob" / "Alice owes you ₹50". Tap a person to see the expenses behind it, and an expense to see its breakup.
- Expenses can be sorted by date, amount or who paid, and grouped into collapsible sections per day (with that day's total) or per person.
- Settling a share takes two steps: the person who owes taps **I've paid** (it shows as *pending verification*), then the payer taps **Received**. The payer can also mark a share received directly, or tap **Not received** to reject it.
- Only the person who added an expense can edit or delete it, and only until a payment on it has been confirmed.
- Any member can rename the group, reset its invite link (the old link stops working), or remove someone, which also resets the link. Anyone can leave. People can only leave or be removed once all their shares are settled.
- Deleting a group needs every member's approval: one person asks, and the others approve or reject. Once everyone approves, the group and all its expenses are deleted.
- The dashboard lists your groups without loading their expenses, which keeps Firestore reads low. Balances are on each group's page.

## Try it locally without a Firebase project

Needs Node 24, [Yarn 1](https://classic.yarnpkg.com) (`npm install -g yarn` if you don't have it) and Java 21+ for the Firebase emulators.

```bash
yarn
yarn dev:local
```

Open http://localhost:3000. Sign-in uses fake Google accounts from the Auth emulator (click **Add new account**). To test as several people at once, use separate browser profiles or private windows. Data is wiped when you stop the command.

## One-time Firebase setup (free Spark plan, no card needed)

1. Go to https://console.firebase.google.com → **Add project**. Google Analytics is not needed.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**, pick a support email, **Save**.
3. **Build → Firestore Database → Create database**. Choose a location close to your users (it can't be changed later) and start in **production mode**.
4. Publish the security rules, either by pasting `firestore.rules` into **Firestore Database → Rules** and clicking **Publish**, or from the terminal:
   ```bash
   yarn firebase login
   yarn firebase deploy --only firestore:rules --project <your-project-id>
   ```
   Do this again whenever `firestore.rules` changes.
5. **Project settings (gear icon) → General → Your apps → Web (`</>`)**, register an app (Firebase Hosting is not needed), and copy the `firebaseConfig` values.
6. Copy `.env.example` to `.env.local` and paste the values in.

Then `yarn dev`, open http://localhost:3000 and sign in with your real Google account.

## Tests

```bash
yarn test        # split, rounding and balance logic
yarn test:rules  # security rules, against the Firestore emulator (needs Java)
```

## Deploying

Deploy to Vercel's free Hobby plan, add the four `NEXT_PUBLIC_FIREBASE_*` variables in the Vercel project settings, then add the Vercel domain under **Authentication → Settings → Authorized domains** in Firebase.

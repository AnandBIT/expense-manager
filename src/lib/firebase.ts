import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";

// `npm run dev:local` sets this to run against the Firebase emulators on this
// machine instead of a real project (see firebase.json for the ports).
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

// These values are public by design: Firebase web config only identifies the
// project. Access control lives in firestore.rules, not in keeping this secret.
const firebaseConfig = useEmulators
  ? {
      apiKey: "demo-api-key",
      authDomain: "demo-expense-manager.firebaseapp.com",
      projectId: "demo-expense-manager",
    }
  : {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

let services: { auth: Auth; db: Firestore } | null = null;

// Initialised lazily so prerendering on the server never touches Firebase.
function firebase() {
  if (services) return services;
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  if (useEmulators && !auth.emulatorConfig) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  }
  services = { auth, db: firestore };
  return services;
}

export function firebaseAuth(): Auth {
  return firebase().auth;
}

export function db(): Firestore {
  return firebase().db;
}

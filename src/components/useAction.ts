import { useState } from "react";
import { errorMessage } from "./ui";

// For buttons that save something: tracks whether it's running and keeps a
// readable error if it fails.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, run };
}

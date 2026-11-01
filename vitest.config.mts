import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The rules tests talk to the Firestore emulator, which can be slow to warm up.
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});

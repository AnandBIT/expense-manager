// Starts Firebase emulators, runs a command against them, then stops them.
//
//   node scripts/with-emulators.mjs <emulators> "<command>"
//   node scripts/with-emulators.mjs firestore "vitest run tests/rules"
//
// Used instead of `firebase emulators:exec`, which on Windows can leave the
// emulator's java.exe running afterwards (Oracle's `javapath` launcher starts
// the real JVM as a child, and only the launcher gets stopped). The next run
// then fails because the port is still taken.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import net from "node:net";

const [only, command] = process.argv.slice(2);
if (!only || !command) {
  console.error('Usage: node scripts/with-emulators.mjs <emulators> "<command>"');
  process.exit(1);
}

const config = JSON.parse(readFileSync("firebase.json", "utf8")).emulators;
const ports = only.split(",").map((name) => config[name].port);
const isWindows = process.platform === "win32";

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function waitForPorts(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const open = await Promise.all(ports.map(isPortOpen));
    if (open.every(Boolean)) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

// Stops the whole process tree, including the JVM the emulators run in.
function stop(child) {
  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    process.kill(-child.pid, "SIGINT");
  }
}

for (const port of ports) {
  if (await isPortOpen(port)) {
    console.error(
      `Port ${port} is already in use. If it's a leftover Firebase emulator, stop its java process and try again.`,
    );
    process.exit(1);
  }
}

const emulators = spawn(
  `npx firebase emulators:start --only ${only} --project demo-expense-manager`,
  { shell: true, detached: !isWindows, stdio: ["ignore", "inherit", "inherit"] },
);

// Ctrl+C reaches the command too; once it exits, `finally` stops the emulators.
process.on("SIGINT", () => {});

let exitCode = 1;
try {
  if (!(await waitForPorts(120_000))) {
    throw new Error("The Firebase emulators didn't start within 2 minutes.");
  }
  const result = spawnSync(command, {
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_USE_EMULATORS: "true",
      FIRESTORE_EMULATOR_HOST: `127.0.0.1:${config.firestore.port}`,
      FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${config.auth.port}`,
    },
  });
  exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  stop(emulators);
}
process.exit(exitCode);

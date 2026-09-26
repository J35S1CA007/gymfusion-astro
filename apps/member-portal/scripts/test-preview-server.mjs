import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const astroPackage = require.resolve("astro/package.json", { paths: [appRoot] });
const astroBin = join(dirname(astroPackage), "bin", "astro.mjs");
const startupTimeoutMs = 30_000;
const pollIntervalMs = 100;

function outputTail(output) {
  return output.trim().slice(-12_000) || "(no startup output captured)";
}

function diagnosticError(message, { baseURL, port, child, state, output }) {
  return new Error(`${message}\nTarget: ${baseURL}\nPort: ${port}\nPID: ${child.pid ?? "unknown"}\nExit code: ${state.code ?? "running"}\nSignal: ${state.signal ?? "none"}\nStartup output:\n${outputTail(output)}`);
}

export async function startTestPreview({ port, readinessPath, env = {} }) {
  if (port === 4348) throw new Error("Protected preview port 4348 cannot be used by a test harness");
  const baseURL = `http://127.0.0.1:${port}`;
  const readinessURL = `${baseURL}${readinessPath}`;
  const child = spawn(process.execPath, [astroBin, "dev", "--ignore-lock", "--json", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: appRoot,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });
  child.testPreviewPort = port;
  let output = "";
  let state = { code: null, signal: null, error: null };
  const capture = (chunk) => { output += chunk.toString(); };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  child.once("exit", (code, signal) => { state = { code, signal }; });
  child.once("error", (error) => { state.error = error; });
  const deadline = Date.now() + startupTimeoutMs;
  const readyMarker = `${baseURL}/`;

  while (Date.now() < deadline) {
    if (state.code !== null || state.signal !== null || state.error) {
      await stopTestPreview(child);
      throw diagnosticError(`Astro test preview failed before readiness${state.error ? `: ${state.error.message}` : ""}`, { baseURL, port, child, state, output });
    }
    if (output.includes(readyMarker)) {
      try {
        const response = await fetch(readinessURL);
        if (response.ok) return child;
      } catch {}
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  await stopTestPreview(child);
  throw diagnosticError("Astro test preview readiness timed out", { baseURL, port, child, state, output });
}

function isRunning(child) {
  return child && child.exitCode === null && !child.signalCode;
}

async function waitForExit(child, timeoutMs) {
  if (!isRunning(child)) return;
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export async function stopTestPreview(child) {
  if (!child?.pid || child.testPreviewPort === 4348) return;
  if (isRunning(child)) {
    if (process.platform !== "win32") {
      try { process.kill(-child.pid, "SIGTERM"); } catch {}
    }
    try { child.kill("SIGTERM"); } catch {}
    await waitForExit(child, 2_000);
  }
  if (isRunning(child)) {
    if (process.platform !== "win32") {
      try { process.kill(-child.pid, "SIGKILL"); } catch {}
    }
    try { child.kill("SIGKILL"); } catch {}
    await waitForExit(child, 2_000);
  }
}

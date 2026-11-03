// Prepares the development Home Assistant from compose.yml: completes onboarding with a
// generated test owner, creates a long-lived token and writes both to the gitignored .env.
// Safe to re-run. Credentials are never printed.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));
const READY_TIMEOUT_MS = 5 * 60_000;
const RESET_HINT =
  "Reset the development instance with `docker compose --profile app down -v`, start it again, and re-run this script.";

function readEnvFile() {
  if (!existsSync(ENV_PATH)) return {};
  return Object.fromEntries(
    readFileSync(ENV_PATH, "utf8")
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2]]),
  );
}

function writeEnvFile(values) {
  const body = Object.entries(values)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  writeFileSync(ENV_PATH, `${body}\n`, { mode: 0o600 });
}

async function waitForHomeAssistant(baseUrl) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      // /api/ answers 401 only once the HTTP API is up, and /manifest.json once the
      // frontend has loaded. Onboarding needs both.
      const [api, frontend] = await Promise.all([
        fetch(`${baseUrl}/api/`),
        fetch(`${baseUrl}/manifest.json`),
      ]);
      if (api.status === 401 && frontend.ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(2_000);
  }
  throw new Error(`Home Assistant did not become ready at ${baseUrl}. Is the container running?`);
}

async function tokenIsValid(baseUrl, token) {
  if (!token) return false;
  const response = await fetch(`${baseUrl}/api/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

async function postJson(url, body, accessToken) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`POST ${new URL(url).pathname} returned ${response.status}`);
  return response.json();
}

async function onboard(baseUrl, username, password) {
  const clientId = `${baseUrl}/`;
  const { auth_code: authCode } = await postJson(`${baseUrl}/api/onboarding/users`, {
    client_id: clientId,
    name: "Dashboard Dev",
    username,
    password,
    language: "en",
  });

  const tokenResponse = await fetch(`${baseUrl}/auth/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: authCode,
      client_id: clientId,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`POST /auth/token returned ${tokenResponse.status}`);
  const { access_token: accessToken } = await tokenResponse.json();

  await postJson(`${baseUrl}/api/onboarding/core_config`, {}, accessToken);
  await postJson(`${baseUrl}/api/onboarding/analytics`, {}, accessToken);
  await postJson(
    `${baseUrl}/api/onboarding/integration`,
    { client_id: clientId, redirect_uri: `${baseUrl}/?auth_callback=1` },
    accessToken,
  );
  return accessToken;
}

function createLongLivedToken(baseUrl, accessToken) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${baseUrl.replace(/^http/, "ws")}/api/websocket`);
    socket.addEventListener("error", () => reject(new Error("WebSocket connection failed")));
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.type === "auth_required") {
        socket.send(JSON.stringify({ type: "auth", access_token: accessToken }));
      } else if (message.type === "auth_ok") {
        socket.send(
          JSON.stringify({
            id: 1,
            type: "auth/long_lived_access_token",
            client_name: "dashboard-dev",
            lifespan: 3650,
          }),
        );
      } else if (message.type === "auth_invalid") {
        reject(new Error("Home Assistant rejected the access token"));
      } else if (message.id === 1) {
        socket.close();
        if (message.success) resolve(message.result);
        else reject(new Error(`Could not create token: ${message.error?.message}`));
      }
    });
  });
}

const env = readEnvFile();
const port = env.HA_PORT ?? process.env.HA_PORT ?? 8124;
const baseUrl = (env.HA_URL ?? `http://localhost:${port}`).replace(/\/$/, "");

console.log(`Waiting for Home Assistant at ${baseUrl}...`);
await waitForHomeAssistant(baseUrl);

if (await tokenIsValid(baseUrl, env.HA_TOKEN)) {
  console.log("The token in .env is valid. Nothing to do.");
  process.exit(0);
}

const onboarding = await fetch(`${baseUrl}/api/onboarding`);
const steps = onboarding.ok ? await onboarding.json() : [];
const userStep = steps.find((step) => step.step === "user");
if (!userStep || userStep.done) {
  console.error(`This Home Assistant is already onboarded, and .env has no valid token. ${RESET_HINT}`);
  process.exit(1);
}

const username = "dashboard-dev";
const password = randomBytes(18).toString("base64url");
const accessToken = await onboard(baseUrl, username, password);
const token = await createLongLivedToken(baseUrl, accessToken);

writeEnvFile({
  ...env,
  HA_URL: baseUrl,
  HA_TOKEN: token,
  HA_DEV_USERNAME: username,
  HA_DEV_PASSWORD: password,
});
console.log("Onboarding finished. The token and test login are in .env.");

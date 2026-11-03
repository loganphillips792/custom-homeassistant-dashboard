import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { openDashboardStore } from "./db.ts";
import { loadEnv } from "./env.ts";
import { startHaClient } from "./ha/connection.ts";
import { EntityHub } from "./ha/entityHub.ts";

const env = loadEnv();
const store = openDashboardStore(env.DB_PATH);
const hub = new EntityHub();
const ha = startHaClient({ url: env.HA_URL, token: env.HA_TOKEN, hub });
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));

serve({ fetch: createApp({ store, hub, ha, webDist }).fetch, port: env.PORT }, ({ port }) => {
  console.log(`Dashboard server listening on port ${port}.`);
});

// Open event streams would keep a graceful close waiting forever, so exit directly.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    store.close();
    process.exit(0);
  });
}

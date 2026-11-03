import { existsSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { csrf } from "hono/csrf";
import { streamSSE } from "hono/streaming";
import { DashboardDocSchema, isToggleable } from "@dashboard/shared";
import type { DashboardStore } from "./db.ts";
import type { HaClient } from "./ha/connection.ts";
import type { EntityHub, HubEvent } from "./ha/entityHub.ts";

const HEARTBEAT_MS = 25_000;
const MAX_BODY_BYTES = 1024 * 1024;
const ENTITY_ID = /^[a-z0-9_]+\.[a-z0-9_]+$/;

export interface AppDependencies {
  store: DashboardStore;
  hub: EntityHub;
  ha: HaClient;
  /** Built front end to serve. Omit in development, where Vite serves it. */
  webDist?: string;
}

/** Compares hosts rather than full origins, so this still works behind a TLS-terminating proxy. */
function isSameHost(origin: string, host: string | undefined): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function createApp({ store, hub, ha, webDist }: AppDependencies): Hono {
  const app = new Hono();

  app.use("/api/*", csrf({ origin: (origin, c) => isSameHost(origin, c.req.header("host")) }));

  app.get("/api/health", (c) =>
    c.json({ ok: true, homeAssistant: hub.isConnected, clients: hub.clientCount }),
  );

  app.get("/api/events", (c) =>
    streamSSE(c, async (stream) => {
      // Writes are chained so that events can't reorder, and a failed write can't reject unobserved.
      let writes = Promise.resolve();
      const enqueue = (write: () => Promise<unknown>) => {
        writes = writes.then(write).then(
          () => undefined,
          () => undefined,
        );
      };
      const send = ({ event, data }: HubEvent) =>
        enqueue(() => stream.writeSSE({ event, data: JSON.stringify(data) }));

      // Subscribing and reading the initial events in one tick means no update can fall between them.
      const unsubscribe = hub.subscribe(send);
      hub.initialEvents().forEach(send);
      const heartbeat = setInterval(() => enqueue(() => stream.write(": ping\n\n")), HEARTBEAT_MS);

      await new Promise<void>((resolve) => stream.onAbort(resolve));
      clearInterval(heartbeat);
      unsubscribe();
    }),
  );

  app.get("/api/dashboard", (c) => c.json(store.load()));

  app.put("/api/dashboard", bodyLimit({ maxSize: MAX_BODY_BYTES }), async (c) => {
    const body: unknown = await c.req.json().catch(() => undefined);
    const result = DashboardDocSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: "Invalid dashboard", issues: result.error.issues }, 400);
    }
    store.save(result.data);
    return c.json(result.data);
  });

  app.post("/api/entities/:id/toggle", async (c) => {
    const id = c.req.param("id");
    if (!ENTITY_ID.test(id)) return c.json({ error: "Invalid entity id" }, 400);
    if (!isToggleable(id)) return c.json({ error: "This domain can't be toggled" }, 403);
    if (!hub.isConnected) return c.json({ error: "Home Assistant is not connected" }, 503);
    if (!hub.has(id)) return c.json({ error: "Unknown entity" }, 404);
    try {
      await ha.toggle(id);
    } catch (error) {
      console.error(`Toggling ${id} failed:`, error);
      return c.json({ error: "Home Assistant could not toggle this entity" }, 502);
    }
    return c.body(null, 204);
  });

  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  if (webDist && existsSync(webDist)) {
    app.use("*", serveStatic({ root: webDist }));
    app.get("*", serveStatic({ path: join(webDist, "index.html") }));
  }

  return app;
}

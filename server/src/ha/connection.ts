import {
  callService,
  createConnection,
  createLongLivedTokenAuth,
  ERR_INVALID_AUTH,
  subscribeEntities,
  type Connection,
} from "home-assistant-js-websocket";
import { setTimeout as sleep } from "node:timers/promises";
import { entityDomain, type EntityMap } from "@dashboard/shared";
import type { EntityHub } from "./entityHub.ts";

const MAX_RETRY_DELAY_MS = 30_000;

export interface HaClient {
  toggle(entityId: string): Promise<void>;
}

const INVALID_TOKEN_MESSAGE =
  "Home Assistant rejected HA_TOKEN. Not retrying. Fix the token and restart the server.";

/**
 * Connects in the background and returns immediately, because Home Assistant may start after
 * this server. The library handles reconnecting once the first connection has succeeded.
 */
export function startHaClient(options: { url: string; token: string; hub: EntityHub }): HaClient {
  const { url, token, hub } = options;
  let connection: Connection | undefined;

  const watch = (conn: Connection) => {
    conn.addEventListener("ready", () => hub.setConnected(true));
    conn.addEventListener("disconnected", () => {
      console.warn("Lost the Home Assistant connection. Reconnecting.");
      hub.setConnected(false);
    });
    conn.addEventListener("reconnect-error", (_conn, error) => {
      if (error === ERR_INVALID_AUTH) console.error(INVALID_TOKEN_MESSAGE);
    });
    // HaEntity is the subset of the library's entity type that the dashboard relies on.
    subscribeEntities(conn, (entities) => hub.update(entities as unknown as EntityMap));
    hub.setConnected(true);
  };

  const connect = async () => {
    const auth = createLongLivedTokenAuth(url, token);
    for (let attempt = 0; ; attempt++) {
      try {
        connection = await createConnection({ auth, setupRetry: 0 });
        console.log(`Connected to Home Assistant at ${url}.`);
        watch(connection);
        return;
      } catch (error) {
        if (error === ERR_INVALID_AUTH) {
          console.error(INVALID_TOKEN_MESSAGE);
          return;
        }
        const delay = Math.min(1_000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
        console.warn(`Can't reach Home Assistant at ${url}. Retrying in ${delay / 1000}s.`);
        await sleep(delay);
      }
    }
  };
  void connect();

  return {
    async toggle(entityId) {
      if (!connection) throw new Error("Not connected to Home Assistant");
      await callService(connection, entityDomain(entityId), "toggle", undefined, {
        entity_id: entityId,
      });
    },
  };
}

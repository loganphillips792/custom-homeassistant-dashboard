import { subscribeEntities, type Connection } from "home-assistant-js-websocket";
import { describe, expect, it } from "vitest";
import type { EntityMap, HaEntity } from "@dashboard/shared";
import { EntityHub, type HubEvent } from "./entityHub.ts";

function entity(id: string, state: string): HaEntity {
  return {
    entity_id: id,
    state,
    attributes: {},
    last_changed: "2026-01-01T00:00:00Z",
    last_updated: "2026-01-01T00:00:00Z",
  };
}

function recordEvents(hub: EntityHub): HubEvent[] {
  const events: HubEvent[] = [];
  hub.subscribe((event) => events.push(event));
  return events;
}

describe("EntityHub", () => {
  it("reports only the entities whose objects changed", () => {
    const hub = new EntityHub();
    const light = entity("light.a", "on");
    const sensor = entity("sensor.b", "1");
    hub.update({ "light.a": light, "sensor.b": sensor });
    const events = recordEvents(hub);

    const newSensor = entity("sensor.b", "2");
    hub.update({ "light.a": light, "sensor.b": newSensor });

    expect(events).toEqual([
      { event: "changes", data: { changed: { "sensor.b": newSensor }, removed: [] } },
    ]);
  });

  it("reports removed entities", () => {
    const hub = new EntityHub();
    const light = entity("light.a", "on");
    hub.update({ "light.a": light, "sensor.b": entity("sensor.b", "1") });
    const events = recordEvents(hub);

    hub.update({ "light.a": light });

    expect(events).toEqual([{ event: "changes", data: { changed: {}, removed: ["sensor.b"] } }]);
    expect(hub.has("sensor.b")).toBe(false);
  });

  it("stays quiet when nothing changed", () => {
    const hub = new EntityHub();
    const entities: EntityMap = { "light.a": entity("light.a", "on") };
    hub.update(entities);
    const events = recordEvents(hub);

    hub.update({ ...entities });

    expect(events).toEqual([]);
  });

  it("gives new clients a snapshot followed by status", () => {
    const hub = new EntityHub();
    const entities: EntityMap = { "light.a": entity("light.a", "on") };
    hub.update(entities);
    hub.setConnected(true);

    expect(hub.initialEvents()).toEqual([
      { event: "snapshot", data: entities },
      { event: "status", data: { connected: true } },
    ]);
  });

  it("announces connection changes once and stops after unsubscribing", () => {
    const hub = new EntityHub();
    const events: HubEvent[] = [];
    const unsubscribe = hub.subscribe((event) => events.push(event));
    expect(hub.clientCount).toBe(1);

    hub.setConnected(true);
    hub.setConnected(true);
    unsubscribe();
    hub.setConnected(false);

    expect(events).toEqual([{ event: "status", data: { connected: true } }]);
    expect(hub.clientCount).toBe(0);
  });

  // Guards the assumption in EntityHub.update against the real library's update handling.
  it("diffs the object identities home-assistant-js-websocket actually produces", async () => {
    const hub = new EntityHub();
    let sendMessage: (message: unknown) => void = () => {};
    const connection = {
      haVersion: "2026.1.0",
      addEventListener: () => {},
      removeEventListener: () => {},
      subscribeMessage: async (callback: (message: unknown) => void) => {
        sendMessage = callback;
        return async () => {};
      },
    } as unknown as Connection;

    subscribeEntities(connection, (entities) => hub.update(entities as unknown as EntityMap));
    await new Promise((resolve) => setTimeout(resolve));

    const compressed = (state: string) => ({ s: state, a: {}, c: "ctx", lc: 1 });
    sendMessage({ a: { "light.a": compressed("off"), "sensor.b": compressed("1") } });
    await new Promise((resolve) => setTimeout(resolve));
    const events = recordEvents(hub);

    sendMessage({ c: { "light.a": { "+": { s: "on", lu: 2 } } } });
    await new Promise((resolve) => setTimeout(resolve));
    sendMessage({ r: ["sensor.b"] });
    await new Promise((resolve) => setTimeout(resolve));

    expect(events).toHaveLength(2);
    const [change, removal] = events;
    if (change?.event !== "changes" || removal?.event !== "changes") {
      throw new Error("Expected two change events");
    }
    expect(Object.keys(change.data.changed)).toEqual(["light.a"]);
    expect(change.data.changed["light.a"]?.state).toBe("on");
    expect(removal.data).toEqual({ changed: {}, removed: ["sensor.b"] });
  });
});

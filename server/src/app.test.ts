import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_DASHBOARD, type DashboardDoc, type HaEntity } from "@dashboard/shared";
import { createApp } from "./app.ts";
import { openDashboardStore } from "./db.ts";
import { EntityHub } from "./ha/entityHub.ts";

const HOST = "dashboard.test:3000";
const SAME_ORIGIN = { Host: HOST, Origin: `http://${HOST}` };

function entity(id: string): HaEntity {
  return {
    entity_id: id,
    state: "off",
    attributes: {},
    last_changed: "2026-01-01T00:00:00Z",
    last_updated: "2026-01-01T00:00:00Z",
  };
}

const doc: DashboardDoc = {
  widgets: [{ id: "a", type: "entity", settings: { entityId: "light.bed_light" } }],
  layouts: { lg: [{ i: "a", x: 0, y: 0, w: 2, h: 2 }], md: [], sm: [] },
};

describe("createApp", () => {
  const toggle = vi.fn<(entityId: string) => Promise<void>>();
  let hub: EntityHub;
  let app: ReturnType<typeof createApp>;

  const request = (path: string, init: RequestInit = {}) =>
    app.request(path, init, undefined, undefined);

  const postToggle = (id: string, headers: Record<string, string> = SAME_ORIGIN) =>
    request(`/api/entities/${id}/toggle`, { method: "POST", headers });

  beforeEach(() => {
    toggle.mockReset().mockResolvedValue();
    hub = new EntityHub();
    hub.update({ "light.bed_light": entity("light.bed_light"), "sensor.temp": entity("sensor.temp") });
    hub.setConnected(true);
    app = createApp({ store: openDashboardStore(":memory:"), hub, ha: { toggle } });
  });

  it("reports health", async () => {
    const response = await request("/api/health");
    expect(await response.json()).toEqual({ ok: true, homeAssistant: true, clients: 0 });
  });

  it("returns 404 for unknown API paths", async () => {
    expect((await request("/api/nope")).status).toBe(404);
  });

  describe("dashboard", () => {
    const put = (body: string) =>
      request("/api/dashboard", {
        method: "PUT",
        headers: { ...SAME_ORIGIN, "Content-Type": "application/json" },
        body,
      });

    it("starts empty, then returns what was saved", async () => {
      expect(await (await request("/api/dashboard")).json()).toEqual(EMPTY_DASHBOARD);
      expect((await put(JSON.stringify(doc))).status).toBe(200);
      expect(await (await request("/api/dashboard")).json()).toEqual(doc);
    });

    it("rejects an invalid document and keeps the saved one", async () => {
      await put(JSON.stringify(doc));
      expect((await put(JSON.stringify({ widgets: "nope" }))).status).toBe(400);
      expect((await put("not json")).status).toBe(400);
      expect(await (await request("/api/dashboard")).json()).toEqual(doc);
    });

    it("rejects an oversized body", async () => {
      expect((await put("x".repeat(1024 * 1024 + 1))).status).toBe(413);
    });
  });

  describe("toggle", () => {
    it("toggles an allowlisted entity", async () => {
      expect((await postToggle("light.bed_light")).status).toBe(204);
      expect(toggle).toHaveBeenCalledWith("light.bed_light");
    });

    it("rejects domains outside the allowlist without calling Home Assistant", async () => {
      expect((await postToggle("sensor.temp")).status).toBe(403);
      expect((await postToggle("lock.front_door")).status).toBe(403);
      expect(toggle).not.toHaveBeenCalled();
    });

    it("rejects malformed and unknown entity ids", async () => {
      expect((await postToggle("light.bed_light%2Fx")).status).toBe(400);
      expect((await postToggle("light.missing")).status).toBe(404);
      expect(toggle).not.toHaveBeenCalled();
    });

    it("rejects a cross-origin request", async () => {
      const response = await postToggle("light.bed_light", {
        Host: HOST,
        Origin: "http://evil.test",
        "Sec-Fetch-Site": "cross-site",
      });
      expect(response.status).toBe(403);
      expect(toggle).not.toHaveBeenCalled();
    });

    it("accepts the same host behind a TLS-terminating proxy", async () => {
      const response = await postToggle("light.bed_light", { Host: HOST, Origin: `https://${HOST}` });
      expect(response.status).toBe(204);
    });

    it("returns 503 while Home Assistant is disconnected", async () => {
      hub.setConnected(false);
      expect((await postToggle("light.bed_light")).status).toBe(503);
    });

    it("returns 502 when Home Assistant fails the call", async () => {
      vi.spyOn(console, "error").mockImplementationOnce(() => {});
      toggle.mockRejectedValue(new Error("nope"));
      expect((await postToggle("light.bed_light")).status).toBe(502);
    });
  });

  describe("events", () => {
    it("streams a snapshot, then status, then changes, and cleans up on abort", async () => {
      const controller = new AbortController();
      const response = await request("/api/events", { signal: controller.signal });
      const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();

      let received = "";
      const readUntil = async (text: string) => {
        while (!received.includes(text)) {
          const { value, done } = await reader.read();
          if (done) throw new Error(`Stream ended before "${text}"`);
          received += value;
        }
      };

      await readUntil("event: status");
      expect(received.indexOf("event: snapshot")).toBeLessThan(received.indexOf("event: status"));
      expect(hub.clientCount).toBe(1);

      hub.update({ "light.bed_light": entity("light.bed_light") });
      await readUntil("event: changes");
      expect(received).toContain('"removed":["sensor.temp"]');

      await reader.cancel();
      await vi.waitFor(() => expect(hub.clientCount).toBe(0));
    });
  });
});

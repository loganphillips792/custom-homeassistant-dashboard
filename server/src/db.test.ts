import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EMPTY_DASHBOARD, type DashboardDoc } from "@dashboard/shared";
import { openDashboardStore } from "./db.ts";

const doc: DashboardDoc = {
  widgets: [{ id: "a", type: "entity", settings: { entityId: "light.bed_light" } }],
  layouts: { lg: [{ i: "a", x: 1, y: 2, w: 3, h: 4 }], md: [], sm: [] },
};

describe("openDashboardStore", () => {
  let directory: string | undefined;

  afterEach(() => {
    if (directory) rmSync(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it("returns the empty dashboard before anything is saved", () => {
    const store = openDashboardStore(":memory:");
    expect(store.load()).toEqual(EMPTY_DASHBOARD);
    store.close();
  });

  it("overwrites the single saved document", () => {
    const store = openDashboardStore(":memory:");
    store.save(EMPTY_DASHBOARD);
    store.save(doc);
    expect(store.load()).toEqual(doc);
    store.close();
  });

  it("persists across reopening, creating missing directories", () => {
    directory = mkdtempSync(join(tmpdir(), "dashboard-db-"));
    const path = join(directory, "nested", "dashboard.db");

    const first = openDashboardStore(path);
    first.save(doc);
    first.close();

    const second = openDashboardStore(path);
    expect(second.load()).toEqual(doc);
    second.close();
  });
});

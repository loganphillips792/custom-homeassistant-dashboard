import { describe, expect, it } from "vitest";
import { DashboardDocSchema, EMPTY_DASHBOARD } from "@dashboard/shared";
import { addWidget, applyGridLayouts, removeWidget, updateSettings } from "./dashboardEdits.ts";

const definition = { defaultSize: { w: 6, h: 2 } };
const two = addWidget(addWidget(EMPTY_DASHBOARD, "a", "entity", definition), "b", "entity", definition);

describe("addWidget", () => {
  it("places the widget below the others at every breakpoint", () => {
    expect(two.layouts.lg.map((item) => item.y)).toEqual([0, 2]);
    expect(two.layouts.md.map((item) => item.y)).toEqual([0, 2]);
    expect(two.layouts.sm.map((item) => item.y)).toEqual([0, 2]);
  });

  it("clamps the width to the breakpoint's columns", () => {
    expect(two.layouts.lg[0]?.w).toBe(6);
    expect(two.layouts.sm[0]?.w).toBe(4);
  });

  it("produces a document the server accepts", () => {
    expect(DashboardDocSchema.safeParse(two).success).toBe(true);
  });
});

describe("removeWidget", () => {
  it("removes the widget and its layout items", () => {
    const doc = removeWidget(two, "a");
    expect(doc.widgets.map((widget) => widget.id)).toEqual(["b"]);
    for (const items of Object.values(doc.layouts)) {
      expect(items.map((item) => item.i)).toEqual(["b"]);
    }
    expect(DashboardDocSchema.safeParse(doc).success).toBe(true);
  });
});

describe("updateSettings", () => {
  it("changes only the named widget", () => {
    const doc = updateSettings(two, "b", { entityId: "light.x" });
    expect(doc.widgets[0]?.settings).toEqual({});
    expect(doc.widgets[1]?.settings).toEqual({ entityId: "light.x" });
  });
});

describe("applyGridLayouts", () => {
  it("keeps breakpoints independent", () => {
    const moved = { i: "a", x: 3, y: 0, w: 2, h: 2 };
    const doc = applyGridLayouts(two, { lg: [moved, two.layouts.lg[1]!] });
    expect(doc.layouts.lg[0]).toEqual(moved);
    expect(doc.layouts.md).toEqual(two.layouts.md);
  });

  it("returns the same document when nothing moved", () => {
    expect(applyGridLayouts(two, two.layouts)).toBe(two);
  });

  it("strips runtime keys, so reports that differ only by them count as unchanged", () => {
    const reported = two.layouts.lg.map((item) => ({ ...item, moved: false, static: false }));
    expect(applyGridLayouts(two, { lg: reported })).toBe(two);
  });

  it("drops items for removed widgets and keeps widgets the grid hasn't seen yet", () => {
    const removed = removeWidget(two, "a");
    const stale = applyGridLayouts(removed, { lg: two.layouts.lg });
    expect(stale.layouts.lg.map((item) => item.i)).toEqual(["b"]);

    const added = addWidget(two, "c", "entity", definition);
    const behind = applyGridLayouts(added, { lg: two.layouts.lg });
    expect(behind.layouts.lg.map((item) => item.i)).toEqual(["a", "b", "c"]);
  });
});

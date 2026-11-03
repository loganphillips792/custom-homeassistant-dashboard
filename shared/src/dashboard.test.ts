import { describe, expect, it } from "vitest";
import { DashboardDocSchema, EMPTY_DASHBOARD } from "./dashboard.ts";

const tile = { id: "a", type: "entity", settings: { entityId: "light.bed_light" } };
const item = { i: "a", x: 0, y: 0, w: 2, h: 2 };

describe("DashboardDocSchema", () => {
  it("accepts the empty dashboard", () => {
    expect(DashboardDocSchema.parse(EMPTY_DASHBOARD)).toEqual(EMPTY_DASHBOARD);
  });

  it("strips the runtime keys react-grid-layout adds to layout items", () => {
    const doc = DashboardDocSchema.parse({
      widgets: [tile],
      layouts: { lg: [{ ...item, moved: false, static: false }], md: [], sm: [] },
    });
    expect(doc.layouts.lg[0]).toEqual(item);
  });

  it("rejects duplicate widget ids", () => {
    const result = DashboardDocSchema.safeParse({
      widgets: [tile, tile],
      layouts: { lg: [], md: [], sm: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects layout items with no matching widget", () => {
    const result = DashboardDocSchema.safeParse({
      widgets: [],
      layouts: { lg: [item], md: [], sm: [] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing breakpoint and non-integer positions", () => {
    expect(
      DashboardDocSchema.safeParse({ widgets: [tile], layouts: { lg: [], md: [] } }).success,
    ).toBe(false);
    expect(
      DashboardDocSchema.safeParse({
        widgets: [tile],
        layouts: { lg: [{ ...item, x: 0.5 }], md: [], sm: [] },
      }).success,
    ).toBe(false);
  });
});

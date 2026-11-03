import { describe, expect, it } from "vitest";
import { z } from "zod";
import entityWidget from "../../widgets/entity/settings.ts";
import { fieldsFromSchema } from "./settingsFields.ts";

describe("fieldsFromSchema", () => {
  it("reads titles, control hints and required flags from the entity widget", () => {
    expect(fieldsFromSchema(entityWidget.schema)).toEqual([
      { key: "entityId", title: "Entity", description: undefined, required: true, kind: "entity" },
      {
        key: "label",
        title: "Label",
        description: "Replaces the entity's name",
        required: false,
        kind: "text",
      },
    ]);
  });

  it("maps each supported type, including optional and defaulted fields", () => {
    const fields = fieldsFromSchema(
      z.object({
        refreshRate: z.number(),
        count: z.int().optional(),
        enabled: z.boolean().default(true),
        mode: z.enum(["a", "b"]),
      }),
    );
    expect(fields).toMatchObject([
      { key: "refreshRate", title: "Refresh Rate", kind: "number", integer: false, required: true },
      { key: "count", kind: "number", integer: true, required: false },
      { key: "enabled", kind: "boolean", required: false },
      { key: "mode", kind: "enum", options: ["a", "b"] },
    ]);
  });
});

describe("entity widget schema", () => {
  it("requires an entity and treats the label as optional", () => {
    expect(entityWidget.schema.safeParse({}).success).toBe(false);
    expect(entityWidget.schema.safeParse({ entityId: "" }).success).toBe(false);
    expect(entityWidget.schema.safeParse({ entityId: "light.a" }).success).toBe(true);
  });
});

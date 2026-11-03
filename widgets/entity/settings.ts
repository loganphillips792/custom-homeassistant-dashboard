import { z } from "zod";
import { defineWidget } from "@dashboard/shared";

export default defineWidget({
  title: "Entity tile",
  defaultSize: { w: 3, h: 2 },
  schema: z.object({
    entityId: z
      .string({ error: "Choose an entity" })
      .min(1, "Choose an entity")
      .meta({ title: "Entity", control: "entity" }),
    label: z.string().optional().meta({ title: "Label", description: "Replaces the entity's name" }),
  }),
});

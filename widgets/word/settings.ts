import { z } from "zod";
import { defineWidget } from "@dashboard/shared";

export default defineWidget({
  title: "Word of the day",
  // Tall enough for the longest definition the sensor can hold, which is 250 characters.
  defaultSize: { w: 4, h: 4 },
  schema: z.object({
    wordEntity: z
      .string()
      .min(1)
      .default("sensor.word_of_the_day")
      .meta({ title: "Word sensor", control: "entity" }),
    definitionEntity: z
      .string()
      .min(1)
      .default("sensor.word_definition")
      .meta({ title: "Definition sensor", control: "entity" }),
  }),
});

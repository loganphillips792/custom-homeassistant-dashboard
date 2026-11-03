import type { z } from "zod";

export interface WidgetDefinition<Schema extends z.ZodObject = z.ZodObject> {
  title: string;
  defaultSize: { w: number; h: number };
  /**
   * Builds the settings panel. Use `.meta({ title })` for field labels, and
   * `.meta({ control: "entity" })` on a string for the entity picker.
   */
  schema: Schema;
}

/** The default export of a widget's `settings.ts`. Keep that file free of React. */
export function defineWidget<Schema extends z.ZodObject>(
  definition: WidgetDefinition<Schema>,
): WidgetDefinition<Schema> {
  return definition;
}

/** Props passed to a widget's `Widget.tsx`, with settings already validated. */
export interface WidgetProps<Definition extends WidgetDefinition> {
  settings: z.infer<Definition["schema"]>;
}

import { z } from "zod";

export type SettingsField = {
  key: string;
  title: string;
  description?: string;
  required: boolean;
} & (
  | { kind: "text" | "boolean" | "entity" }
  | { kind: "number"; integer: boolean }
  | { kind: "enum"; options: string[] }
);

interface JsonSchemaProperty {
  type?: string;
  enum?: unknown[];
  title?: string;
  description?: string;
  control?: string;
}

function titleFromKey(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Describes the form for a widget's settings. Fields of unsupported types are left out. */
export function fieldsFromSchema(schema: z.ZodObject): SettingsField[] {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as {
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };

  const fields: SettingsField[] = [];
  for (const [key, property] of Object.entries(json.properties ?? {})) {
    const base = {
      key,
      title: property.title ?? titleFromKey(key),
      description: property.description,
      required: json.required?.includes(key) ?? false,
    };
    if (property.control === "entity") {
      fields.push({ ...base, kind: "entity" });
    } else if (property.enum) {
      fields.push({ ...base, kind: "enum", options: property.enum.map(String) });
    } else if (property.type === "string") {
      fields.push({ ...base, kind: "text" });
    } else if (property.type === "number" || property.type === "integer") {
      fields.push({ ...base, kind: "number", integer: property.type === "integer" });
    } else if (property.type === "boolean") {
      fields.push({ ...base, kind: "boolean" });
    } else {
      console.warn(`The settings panel can't edit "${key}", so it was left out.`);
    }
  }
  return fields;
}

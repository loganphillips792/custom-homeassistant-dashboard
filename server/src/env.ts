import { fileURLToPath } from "node:url";
import { z } from "zod";

const EnvSchema = z.object({
  HA_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  HA_TOKEN: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_PATH: z.string().min(1).default(fileURLToPath(new URL("../../data/dashboard.db", import.meta.url))),
});
export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (result.success) return result.data;
  // Names only: a value might be the token.
  const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Missing or invalid environment variables: ${fields}. See .env.example.`);
}

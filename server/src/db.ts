import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { DashboardDocSchema, EMPTY_DASHBOARD, type DashboardDoc } from "@dashboard/shared";

/** Each entry runs once, in order. `PRAGMA user_version` records how many have run. */
const MIGRATIONS = [
  `CREATE TABLE dashboard (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     doc TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
];

export interface DashboardStore {
  load(): DashboardDoc;
  save(doc: DashboardDoc): void;
  close(): void;
}

export function openDashboardStore(path: string): DashboardStore {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");

  const version = db.pragma("user_version", { simple: true }) as number;
  db.transaction(() => {
    for (const migration of MIGRATIONS.slice(version)) db.exec(migration);
    db.pragma(`user_version = ${MIGRATIONS.length}`);
  })();

  const select = db.prepare<[], { doc: string }>("SELECT doc FROM dashboard WHERE id = 1");
  const upsert = db.prepare<[string, string]>(
    `INSERT INTO dashboard (id, doc, updated_at) VALUES (1, ?, ?)
     ON CONFLICT (id) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at`,
  );

  return {
    load() {
      const row = select.get();
      return row ? DashboardDocSchema.parse(JSON.parse(row.doc)) : EMPTY_DASHBOARD;
    },
    save(doc) {
      upsert.run(JSON.stringify(doc), new Date().toISOString());
    },
    close() {
      db.close();
    },
  };
}

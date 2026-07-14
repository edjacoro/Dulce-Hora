import { PGlite } from "@electric-sql/pglite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./env.js";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
loadLocalEnv(rootDir);

const dataDir = process.env.DATA_DIR ?? join(rootDir, "data", "pglite");
const migrationsDir = join(rootDir, "server", "migrations");

mkdirSync(dataDir, { recursive: true });

export const db = new PGlite(dataDir);

export async function migrate() {
  await db.exec(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const existing = await db.query("select id from schema_migrations where id = $1", [file]);
    if (existing.rows.length > 0) continue;

    const sql = readFileSync(join(migrationsDir, file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into schema_migrations (id) values ($1)", [file]);
    });
  }
}

export async function queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const result = await db.query<T>(sql, params);
  return result.rows[0] ?? null;
}

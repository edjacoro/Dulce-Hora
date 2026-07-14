import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./env.js";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
loadLocalEnv(rootDir);

type QueryResult<T> = {
  rows: T[];
};

type Queryable = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<unknown>;
};

type Database = Queryable & {
  transaction<T>(callback: (tx: Queryable) => Promise<T>): Promise<T>;
};

const defaultDataDir = process.env.NETLIFY === "true"
  ? join("/tmp", "dulce-hora-pglite")
  : join(rootDir, "data", "pglite");
const dataDir = process.env.DATA_DIR ?? defaultDataDir;
const migrationsDir = join(rootDir, "server", "migrations");
const databaseUrl = process.env.DATABASE_URL;

function createDatabase(): Database {
  if (databaseUrl) {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined
    });

    return {
      async query<T = unknown>(sql: string, params: unknown[] = []) {
        const result = await pool.query(sql, params);
        return { rows: result.rows as T[] };
      },
      async exec(sql: string) {
        await pool.query(sql);
      },
      async transaction<T>(callback: (tx: Queryable) => Promise<T>) {
        const client = await pool.connect();
        const tx: Queryable = {
          async query<T = unknown>(sql: string, params: unknown[] = []) {
            const result = await client.query(sql, params);
            return { rows: result.rows as T[] };
          },
          async exec(sql: string) {
            await client.query(sql);
          }
        };

        try {
          await client.query("begin");
          const result = await callback(tx);
          await client.query("commit");
          return result;
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
      }
    };
  }

  mkdirSync(dataDir, { recursive: true });
  return new PGlite(dataDir) as unknown as Database;
}

function shouldUseSsl(url: string) {
  return process.env.PGSSLMODE !== "disable" && !url.includes("localhost") && !url.includes("127.0.0.1");
}

export const db = createDatabase();

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

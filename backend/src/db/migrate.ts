import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_POOL_MAX || "20"),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || "60000"),
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || "15000"),
  keepAlive: true,
  keepAliveInitialDelayMillis: parseInt(process.env.PG_KEEPALIVE_DELAY || "10000"),
  ssl:
    process.env.PG_SSL === "true"
      ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== "false" }
      : undefined,
});

const db = drizzle(pool);

async function main() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations completed!");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

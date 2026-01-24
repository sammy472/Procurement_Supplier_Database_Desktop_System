import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
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

pool.on("error", (err) => {
  console.error("Postgres pool error:", err);
});

export const db = drizzle(pool, { schema });

import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema";

export function createDatabase(client: Sql) {
  return drizzle(client, { schema });
}

export type WeddingDatabase = ReturnType<typeof createDatabase>;

let client: Sql | undefined;
let database: WeddingDatabase | undefined;

export function getDatabase(): WeddingDatabase {
  if (database) return database;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL non configurato");

  client = postgres(url, { max: 10, prepare: false });
  database = createDatabase(client);
  return database;
}

import { sql } from "drizzle-orm";

import { getDatabase } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Liveness + readiness. Liveness is implicit (the handler responds); readiness
 * checks that the database is reachable. Returns 503 when not ready so a load
 * balancer can hold traffic. No internal detail is leaked.
 */
export async function GET(): Promise<Response> {
  let database: "ok" | "unavailable" = "unavailable";
  try {
    if (process.env.DATABASE_URL) {
      await getDatabase().execute(sql`select 1`);
      database = "ok";
    }
  } catch {
    database = "unavailable";
  }
  const ready = database === "ok";
  return Response.json(
    { status: ready ? "ok" : "degraded", checks: { database } },
    {
      status: ready ? 200 : 503,
      headers: { "cache-control": "no-store" }
    }
  );
}

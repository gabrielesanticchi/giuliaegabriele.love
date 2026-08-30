import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi
} from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn()
}));

import { createDatabase, type WeddingDatabase } from "@/db";
import { adminUsers, mediaAssets, storyMoments } from "@/db/schema";
import { saveStoryMomentAction } from "@/actions/admin/content";
import { withAdminAuthDependencies } from "@/actions/admin/shared";
import type { AdminPrincipal } from "@/lib/auth/authorization";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration(
  "story media validation (requires TEST_DATABASE_URL; skipped without a real database)",
  () => {
    let client: postgres.Sql;
    let db: WeddingDatabase;
    const adminId = randomUUID();
    const principal: AdminPrincipal = {
      id: adminId,
      role: "owner",
      sessionVersion: 1,
      isActive: true
    };

    beforeAll(async () => {
      process.env.DATABASE_URL = databaseUrl!;
      client = postgres(databaseUrl!, { max: 4, prepare: false });
      db = createDatabase(client);
      await migrate(db, { migrationsFolder: "drizzle" });
      await db.insert(adminUsers).values({
        id: adminId,
        emailHash: randomBytes(32).toString("hex"),
        emailEncrypted: "test",
        passwordHash: "test",
        role: "owner"
      });
    });

    afterAll(async () => {
      if (!client) return;
      await db.delete(storyMoments);
      await db.delete(mediaAssets);
      await db.delete(adminUsers).where(eq(adminUsers.id, adminId));
      await client.end();
    });

    afterEach(async () => {
      await db.delete(storyMoments);
      await db.delete(mediaAssets);
    });

    function storyForm(fields: Record<string, string>): FormData {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) form.set(key, value);
      return form;
    }

    const save = (form: FormData) =>
      withAdminAuthDependencies({ getPrincipal: async () => principal }, () =>
        saveStoryMomentAction(form)
      );

    async function insertMedia(archived: boolean): Promise<string> {
      const id = randomUUID();
      await db.insert(mediaAssets).values({
        id,
        pathname: `storia/${id}.jpg`,
        contentType: "image/jpeg",
        sizeBytes: 2048,
        altText: "Un ricordo",
        archivedAt: archived ? new Date() : null
      });
      return id;
    }

    it("persists a story moment linked to a valid, non-archived media asset", async () => {
      const mediaId = await insertMedia(false);
      const result = await save(
        storyForm({
          title: "Il primo viaggio",
          body: "Il racconto del nostro primo viaggio",
          mediaAssetId: mediaId,
          sortOrder: "0",
          published: "true"
        })
      );
      expect(result).toEqual({ ok: true, message: "Momento salvato" });
      const rows = await db.select().from(storyMoments);
      expect(rows).toHaveLength(1);
      expect(rows[0].mediaAssetId).toBe(mediaId);
    });

    it("rolls back a story moment referencing a non-existent media asset", async () => {
      await expect(
        save(
          storyForm({
            title: "Momento",
            body: "Testo del momento",
            mediaAssetId: randomUUID(),
            sortOrder: "0",
            published: "true"
          })
        )
      ).rejects.toThrow("Media non valido");
      expect(await db.select().from(storyMoments)).toHaveLength(0);
    });

    it("rolls back a story moment referencing an archived media asset", async () => {
      const mediaId = await insertMedia(true);
      await expect(
        save(
          storyForm({
            title: "Momento",
            body: "Testo del momento",
            mediaAssetId: mediaId,
            sortOrder: "0",
            published: "true"
          })
        )
      ).rejects.toThrow("Media non valido");
      expect(await db.select().from(storyMoments)).toHaveLength(0);
    });
  }
);

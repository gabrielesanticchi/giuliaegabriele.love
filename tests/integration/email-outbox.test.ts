import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import {
  afterAll,
  beforeAll,
  beforeEach,
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
import {
  adminUsers,
  emailDeliveries,
  giftCategories,
  giftIntents,
  gifts
} from "@/db/schema";
import { enqueueVerificationDelivery } from "@/lib/email";
import { processPendingEmailDeliveriesAction } from "@/actions/admin/requests";
import { withAdminAuthDependencies } from "@/actions/admin/shared";
import type { AdminPrincipal } from "@/lib/auth/authorization";
import { encryptSecret } from "@/lib/security/crypto";
import { hashEmail } from "@/lib/security/hashing";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration(
  "email outbox (requires TEST_DATABASE_URL; skipped without a real database)",
  () => {
    let client: postgres.Sql;
    let db: WeddingDatabase;
    let encryptionKey: string;
    let pepper: string;
    const adminId = randomUUID();
    const giftId = randomUUID();

    const owner: AdminPrincipal = {
      id: adminId,
      role: "owner",
      sessionVersion: 1,
      isActive: true,
      totpPending: false
    };

    async function insertIntent(reference: string): Promise<string> {
      const id = randomUUID();
      await db.insert(giftIntents).values({
        id,
        publicReference: reference,
        giftId,
        kind: "contribution",
        method: "bank_transfer",
        status: "pending",
        amountCents: 5000,
        appliedAmountCents: 5000,
        idempotencyKey: randomUUID(),
        requestFingerprintHash: randomBytes(32).toString("hex"),
        guestTokenHash: randomBytes(32).toString("hex"),
        guestDetailsEncrypted: encryptSecret(
          JSON.stringify({
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@example.test",
            privacyVersion: "v1"
          }),
          encryptionKey
        ),
        guestEmailHash: hashEmail("ada@example.test", pepper),
        expiresAt: new Date(Date.now() + 3_600_000)
      });
      return id;
    }

    beforeAll(async () => {
      encryptionKey = randomBytes(32).toString("base64");
      pepper = randomBytes(32).toString("hex");
      process.env.DATABASE_URL = databaseUrl!;
      process.env.DATA_ENCRYPTION_KEY = encryptionKey;
      process.env.REQUEST_FINGERPRINT_SECRET = pepper;
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_FROM;
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
      await db.insert(giftCategories).values({
        id: randomUUID(),
        slug: `cat-${giftId}`,
        name: "Casa"
      });
      await db.insert(gifts).values({
        id: giftId,
        publicReference: `G-${giftId}`,
        title: "Tavolo",
        priceCents: 10000
      });
    });

    afterAll(async () => {
      if (!client) return;
      await db.delete(emailDeliveries);
      await db.delete(giftIntents);
      await db.delete(gifts).where(eq(gifts.id, giftId));
      await db.delete(adminUsers).where(eq(adminUsers.id, adminId));
      await client.end();
    });

    beforeEach(async () => {
      await db.delete(emailDeliveries);
      await db.delete(giftIntents);
    });

    it("recovers its own delivery on conflict and never reuses another intent's", async () => {
      const intentA = await insertIntent(`A-${randomUUID()}`);
      const intentB = await insertIntent(`B-${randomUUID()}`);
      const key = randomUUID();

      const first = await db.transaction((tx) =>
        enqueueVerificationDelivery(tx, {
          intentId: intentA,
          idempotencyKey: key,
          hashingSecret: pepper
        })
      );
      const replay = await db.transaction((tx) =>
        enqueueVerificationDelivery(tx, {
          intentId: intentA,
          idempotencyKey: key,
          hashingSecret: pepper
        })
      );
      expect(replay).toBe(first);

      await expect(
        db.transaction((tx) =>
          enqueueVerificationDelivery(tx, {
            intentId: intentB,
            idempotencyKey: key,
            hashingSecret: pepper
          })
        )
      ).rejects.toThrow();

      const rows = await db
        .select()
        .from(emailDeliveries)
        .where(eq(emailDeliveries.idempotencyKey, key));
      expect(rows).toHaveLength(1);
      expect(rows[0].intentId).toBe(intentA);
    });

    it("flushes pending/failed deliveries without a provider and stays idempotent", async () => {
      const intentId = await insertIntent(`R-${randomUUID()}`);
      await db.insert(emailDeliveries).values([
        {
          intentId,
          recipientHash: randomBytes(32).toString("hex"),
          templateKey: "gift_verification",
          idempotencyKey: randomUUID(),
          status: "pending"
        },
        {
          intentId,
          recipientHash: randomBytes(32).toString("hex"),
          templateKey: "gift_verification",
          idempotencyKey: randomUUID(),
          status: "failed"
        }
      ]);

      const run = () =>
        withAdminAuthDependencies({ getPrincipal: async () => owner }, () =>
          processPendingEmailDeliveriesAction()
        );

      const first = await run();
      expect(first.ok).toBe(true);

      const afterFirst = await db.select().from(emailDeliveries);
      expect(afterFirst).toHaveLength(2);
      expect(afterFirst.every((row) => row.status === "skipped")).toBe(true);

      // Idempotent: a second flush neither throws nor deletes deliveries.
      const second = await run();
      expect(second.ok).toBe(true);
      expect(await db.select().from(emailDeliveries)).toHaveLength(2);
    });
  }
);

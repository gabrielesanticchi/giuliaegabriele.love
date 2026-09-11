import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { giftIntents } from "@/db/schema";

describe("registry fund schema", () => {
  it("allows contributions without a gift while requiring one for full gifts", () => {
    const config = getTableConfig(giftIntents);
    const giftId = config.columns.find((column) => column.name === "gift_id");
    const fullGiftConstraint = config.checks.find(
      (constraint) => constraint.name === "gift_intents_full_gift_requires_gift"
    );
    const contributionConstraint = config.checks.find(
      (constraint) =>
        constraint.name === "gift_intents_contribution_has_no_gift"
    );

    expect(giftId?.notNull).toBe(false);
    expect(fullGiftConstraint).toBeDefined();
    expect(contributionConstraint).toBeDefined();
  });
});

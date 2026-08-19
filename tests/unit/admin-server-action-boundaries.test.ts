import { describe, expect, it } from "vitest";

import { saveStructuredContentAction } from "@/actions/admin/content";
import { saveGiftAction } from "@/actions/admin/gifts";
import { rejectRequestAction } from "@/actions/admin/requests";
import { publishSiteAction, saveBankingAction } from "@/actions/admin/settings";
import { withAdminAuthDependencies } from "@/actions/admin/shared";

const unauthenticated = { getPrincipal: async () => null };
const boundaries: Array<[string, () => Promise<unknown>]> = [
  ["content", () => saveStructuredContentAction(new FormData())],
  ["gift", () => saveGiftAction(new FormData())],
  ["request", () => rejectRequestAction(new FormData())],
  ["banking", () => saveBankingAction(new FormData())],
  ["publish", () => publishSiteAction(new FormData())]
];

describe("exported admin Server Action auth boundaries", () => {
  it.each(boundaries)(
    "rejects unauthenticated %s before parsing or database access",
    async (_name, invoke) => {
      await expect(
        withAdminAuthDependencies(unauthenticated, invoke)
      ).rejects.toThrow("Accesso amministratore richiesto");
    }
  );
});

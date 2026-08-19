import "server-only";

import {
  assertAdminPrincipal,
  type AdminPrincipal,
  type AdminRole
} from "@/lib/auth/authorization";

export const ADMIN_ACTION_POLICIES = {
  "content.save": "editor",
  "schedule.save": "editor",
  "schedule.delete": "editor",
  "story.save": "editor",
  "story.delete": "editor",
  "dress-code.save": "editor",
  "gift-category.save": "editor",
  "gift.save": "editor",
  "gift.duplicate": "editor",
  "gift.archive": "editor",
  "gift.reorder": "editor",
  "gift.publish": "editor",
  "gift.hide": "editor",
  "request.verify": "owner",
  "request.cancel": "owner",
  "request.reject": "owner",
  "request.unlock": "owner",
  "request.extend": "owner",
  "request.note": "owner",
  "request.manual": "owner",
  "request.resend-email": "owner",
  "request.export": "owner",
  "media.save": "editor",
  "settings.save": "owner",
  "banking.view": "owner",
  "banking.save": "owner",
  "site.publish": "owner",
  "site.unpublish": "owner",
  "totp.enroll": "editor",
  "totp.reset-recovery": "owner"
} as const satisfies Record<string, AdminRole>;

export type AdminActionName = keyof typeof ADMIN_ACTION_POLICIES;

export function authorizeAdminAction(
  action: string,
  principal: AdminPrincipal | null
): asserts principal is AdminPrincipal {
  if (!(action in ADMIN_ACTION_POLICIES)) {
    throw new TypeError("Azione amministrativa sconosciuta");
  }
  assertAdminPrincipal(
    principal,
    ADMIN_ACTION_POLICIES[action as AdminActionName],
    { allowTotpPending: action === "totp.enroll" }
  );
}

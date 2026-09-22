import "server-only";

import {
  assertAdminPrincipal,
  type AdminPrincipal,
  type AdminRole
} from "@/lib/auth/authorization";

export const ADMIN_ACTION_POLICIES = {
  "gift-category.save": "editor",
  "gift.save": "editor",
  "gift.duplicate": "editor",
  "gift.archive": "editor",
  "gift.publish": "editor",
  "gift.hide": "editor",
  "gift.complete": "editor",
  "request.verify": "owner",
  "request.cancel": "owner",
  "request.reject": "owner",
  "request.unlock": "owner",
  "request.extend": "owner",
  "request.note": "owner",
  "request.manual": "owner",
  "request.resend-email": "owner",
  "request.process-pending-emails": "owner",
  "request.export": "owner",
  "banking.view": "owner",
  "banking.save": "owner"
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
    ADMIN_ACTION_POLICIES[action as AdminActionName]
  );
}

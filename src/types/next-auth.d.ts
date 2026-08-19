import type { DefaultSession } from "next-auth";
import type { AdminRole } from "@/lib/auth/authorization";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      adminId: string;
      role: AdminRole;
      sessionVersion: number;
      totpPending: boolean;
    };
  }

  interface User {
    adminId: string;
    role: AdminRole;
    sessionVersion: number;
    totpPending: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    adminId?: string;
    role?: AdminRole;
    sessionVersion?: number;
    totpPending?: boolean;
    invalid?: boolean;
  }
}

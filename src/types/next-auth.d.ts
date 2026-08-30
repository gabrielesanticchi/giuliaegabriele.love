import type { DefaultSession } from "next-auth";
import type { AdminRole } from "@/lib/auth/authorization";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      adminId: string;
      role: AdminRole;
      sessionVersion: number;
    };
  }

  interface User {
    adminId: string;
    role: AdminRole;
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    adminId?: string;
    role?: AdminRole;
    sessionVersion?: number;
    invalid?: boolean;
  }
}

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { authenticateAdmin, loadAdminPrincipal } from "@/lib/auth/repository";

const secure = process.env.NODE_ENV === "production";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/admin/login" },
  cookies: {
    sessionToken: {
      name: secure
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure
      }
    }
  },
  providers: [
    CredentialsProvider({
      name: "Amministrazione",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        code: { label: "Codice TOTP o recupero", type: "text" }
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials.password) return null;
        const headers = request.headers as unknown as Record<
          string,
          string | string[] | undefined
        >;
        const forwarded = headers["x-forwarded-for"];
        const clientIdentity = [
          Array.isArray(forwarded) ? forwarded[0] : forwarded,
          headers["user-agent"]
        ]
          .filter(Boolean)
          .join("|");
        const principal = await authenticateAdmin({
          email: credentials.email,
          password: credentials.password,
          code: credentials.code,
          clientIdentity: clientIdentity || "unknown"
        });
        if (!principal) return null;
        return {
          id: principal.id,
          adminId: principal.id,
          role: principal.role,
          sessionVersion: principal.sessionVersion,
          totpPending: principal.totpPending
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.adminId = user.adminId;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
        token.totpPending = user.totpPending;
      }
      if (token.adminId) {
        const current = await loadAdminPrincipal(token.adminId);
        if (
          !current?.isActive ||
          current.sessionVersion !== token.sessionVersion ||
          current.role !== token.role
        ) {
          token.invalid = true;
        } else {
          token.invalid = false;
          token.totpPending = current.totpPending;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (
        token.invalid ||
        !token.adminId ||
        !token.role ||
        !token.sessionVersion
      ) {
        return { ...session, user: undefined };
      }
      session.user = {
        ...session.user,
        adminId: token.adminId,
        role: token.role,
        sessionVersion: token.sessionVersion,
        totpPending: Boolean(token.totpPending)
      };
      return session;
    }
  }
};

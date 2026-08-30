import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { authenticateAdmin, loadAdminPrincipal } from "@/lib/auth/repository";
import {
  ClientIdentityUnavailableError,
  resolveClientIdentity
} from "@/lib/public-api/client-identity";

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
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials.password) return null;
        const headers = new Headers(request.headers as HeadersInit);
        let clientIdentity: string;
        try {
          clientIdentity = resolveClientIdentity(
            new Request("https://auth.local", { headers }),
            {
              production: secure,
              trustedProxyHeader:
                process.env.VERCEL === "1"
                  ? "x-vercel-forwarded-for"
                  : process.env.TRUSTED_PROXY_IP_HEADER
            }
          ).fingerprintMaterial;
        } catch (error) {
          if (error instanceof ClientIdentityUnavailableError) return null;
          throw error;
        }
        const principal = await authenticateAdmin({
          email: credentials.email,
          password: credentials.password,
          clientIdentity
        });
        if (!principal) return null;
        return {
          id: principal.id,
          adminId: principal.id,
          role: principal.role,
          sessionVersion: principal.sessionVersion
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
      }
      if (token.adminId) {
        const current = await loadAdminPrincipal(token.adminId);
        token.invalid = !(
          current?.isActive &&
          current.sessionVersion === token.sessionVersion &&
          current.role === token.role
        );
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
        sessionVersion: token.sessionVersion
      };
      return session;
    }
  }
};

/**
 * Edge-safe auth config — NO Node.js imports (no DB, no fs, no path).
 * Used by middleware which runs on the Edge Runtime.
 * The full auth (with DB) lives in auth/index.ts.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.clientId = (user as { clientId?: string }).clientId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "CLIENT";
        session.user.clientId = token.clientId as string | undefined;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      // This is called by middleware — keep it edge-safe (no DB)
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const publicRoutes = ["/login", "/invite"];
      const isPublic = publicRoutes.some((r) => pathname.startsWith(r));
      if (isPublic) return true;

      return isLoggedIn;
    },
  },
  providers: [], // Providers added in full auth/index.ts
};

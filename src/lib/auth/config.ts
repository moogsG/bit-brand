/**
 * Edge-safe auth config — NO Node.js imports (no DB, no fs, no path).
 * Used by middleware which runs on the Edge Runtime.
 * The full auth (with DB) lives in auth/index.ts.
 */
import type { NextAuthConfig } from "next-auth";
import { toLegacyRole, type AppUserRole } from "./role-mapping";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const rawRole = (user as { role?: string }).role;
        token.id = user.id;
        token.rawRole = rawRole;
        token.role = toLegacyRole(rawRole);
        token.clientId = (user as { clientId?: string }).clientId;
        token.name = user.name;
        token.email = user.email;
        token.picture = (user as { image?: string }).image;
      }

      if (trigger === "update" && session) {
        const sessionUser = (session as { user?: { name?: string; image?: string } }).user;
        const updatedName =
          typeof sessionUser?.name === "string"
            ? sessionUser.name
            : typeof (session as { name?: string }).name === "string"
              ? (session as { name?: string }).name
              : undefined;
        const updatedImage =
          typeof sessionUser?.image === "string"
            ? sessionUser.image
            : typeof (session as { image?: string }).image === "string"
              ? (session as { image?: string }).image
              : undefined;

        if (updatedName !== undefined) token.name = updatedName;
        if (updatedImage !== undefined) token.picture = updatedImage;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = toLegacyRole(
          (token.rawRole as string | undefined) ?? (token.role as string | undefined),
        );
        session.user.rawRole =
          (token.rawRole as AppUserRole | undefined) ??
          (token.role as AppUserRole | undefined);
        session.user.clientId = token.clientId as string | undefined;
        if (typeof token.name === "string") session.user.name = token.name;
        if (typeof token.email === "string") session.user.email = token.email;
        if (typeof token.picture === "string") session.user.image = token.picture;
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

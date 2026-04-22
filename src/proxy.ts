/**
 * Middleware — runs on Edge Runtime.
 * Uses edge-safe authConfig ONLY (no DB, no Node.js APIs).
 */
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";
import { can } from "@/lib/auth/authorize";

const { auth } = NextAuth(authConfig);

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes — always accessible
  const publicRoutes = ["/login", "/invite"];
  const isPublic = publicRoutes.some((r) => pathname.startsWith(r));
  if (isPublic) return NextResponse.next();

  // Not authenticated — redirect to login
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const user = session.user as { role?: string; rawRole?: string };
  const authz = { role: user.role, rawRole: user.rawRole };

  // Admin routes
  if (pathname.startsWith("/admin") && !can("admin", "view", authz)) {
    return NextResponse.redirect(new URL("/portal", req.url));
  }

  // Root redirect based on role
  if (pathname === "/") {
    if (can("admin", "view", authz)) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
    if (can("portal", "view", authz)) {
      return NextResponse.redirect(new URL("/portal", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

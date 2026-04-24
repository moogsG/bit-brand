/**
 * Full auth config — uses DB, bcrypt, etc.
 * Only imported in server components, API routes, and server actions.
 * NEVER import this in middleware.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { users, clientUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "./config";
import { isClientEquivalentRole, toLegacyRole } from "./role-mapping";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .get();

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        const rawRole = user.role;

        // For client-equivalent roles, get their clientId
        let clientId: string | undefined;
        if (isClientEquivalentRole(rawRole)) {
          const clientUser = await db
            .select()
            .from(clientUsers)
            .where(eq(clientUsers.userId, user.id))
            .get();
          clientId = clientUser?.clientId;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl ?? undefined,
          role: toLegacyRole(rawRole),
          rawRole,
          clientId,
        };
      },
    }),
  ],
});

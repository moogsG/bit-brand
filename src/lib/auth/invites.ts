import { db } from "@/lib/db";
import { invitations, users, clientUsers, clients } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";

export async function createInvitation({
  email,
  clientId,
  createdBy,
}: {
  email: string;
  clientId: string;
  createdBy: string;
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invitation] = await db
    .insert(invitations)
    .values({ email, clientId, token, expiresAt, createdBy })
    .returning();

  return invitation;
}

export async function validateInviteToken(token: string) {
  const invitation = await db
    .select({
      invitation: invitations,
      client: clients,
    })
    .from(invitations)
    .innerJoin(clients, eq(invitations.clientId, clients.id))
    .where(
      and(
        eq(invitations.token, token),
        gt(invitations.expiresAt, new Date()),
      )
    )
    .get();

  if (!invitation) return null;
  if (invitation.invitation.acceptedAt) return null; // Already used

  return invitation;
}

export async function acceptInvitation({
  token,
  name,
  password,
}: {
  token: string;
  name: string;
  password: string;
}) {
  const valid = await validateInviteToken(token);
  if (!valid) throw new Error("Invalid or expired invitation");

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const [user] = await db
    .insert(users)
    .values({
      email: valid.invitation.email,
      name,
      passwordHash,
      role: "CLIENT",
    })
    .returning();

  // Link user to client
  await db.insert(clientUsers).values({
    clientId: valid.invitation.clientId,
    userId: user.id,
  });

  // Mark invitation as accepted
  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.token, token));

  return user;
}

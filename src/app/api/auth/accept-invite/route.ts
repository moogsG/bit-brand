import { NextRequest, NextResponse } from "next/server";
import { acceptInvitation } from "@/lib/auth/invites";
import { z } from "zod";

const schema = z.object({
  token: z.string(),
  name: z.string().min(2),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, name, password } = schema.parse(body);
    await acceptInvitation({ token, name, password });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to accept invitation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

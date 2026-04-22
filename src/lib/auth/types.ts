import type { DefaultSession } from "next-auth";
import type { AppUserRole, LegacyRole } from "./role-mapping";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: LegacyRole;
      rawRole?: AppUserRole;
      clientId?: string;
    } & DefaultSession["user"];
  }
}

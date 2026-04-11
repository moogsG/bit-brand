import { validateInviteToken } from "@/lib/auth/invites";
import { AcceptInviteForm } from "@/components/auth/accept-invite-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { themeConfig } from "@/lib/theme.config";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const invitation = await validateInviteToken(token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <span className="text-primary-foreground font-bold text-lg">
              {themeConfig.brand.shortName}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {themeConfig.brand.name}
          </h1>
        </div>

        {!invitation ? (
          <Card>
            <CardHeader>
              <CardTitle>Invalid Invitation</CardTitle>
              <CardDescription>
                This invitation link is invalid or has expired. Please contact
                your account manager.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Accept Your Invitation</CardTitle>
              <CardDescription>
                You&apos;ve been invited to access the{" "}
                {invitation.client.name} portal. Set up your account to get
                started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AcceptInviteForm
                token={token}
                email={invitation.invitation.email}
                clientName={invitation.client.name}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

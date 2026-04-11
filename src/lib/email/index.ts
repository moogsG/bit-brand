/**
 * Email sending utilities.
 * Uses Resend when RESEND_API_KEY is set; otherwise logs to console (POC mode).
 */

export interface InviteEmailParams {
  to: string;
  inviteUrl: string;
  clientName: string;
}

export interface ReportEmailParams {
  to: string;
  reportTitle: string;
  portalUrl: string;
}

type ResendResponse = { id?: string; error?: string };

async function sendViaResend(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.json() as ResendResponse;
    throw new Error(`Resend API error: ${body.error ?? res.statusText}`);
  }
}

const FROM_ADDRESS =
  process.env.RESEND_FROM ?? "BIT Brand Anarchy <noreply@bitbrandanarchy.com>";

export async function sendInviteEmail({ to, inviteUrl, clientName }: InviteEmailParams): Promise<void> {
  const subject = `You've been invited to the ${clientName} SEO portal`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 22px; color: #111;">Welcome to your SEO portal</h1>
      <p style="color: #444; line-height: 1.6;">
        You've been granted access to the <strong>${clientName}</strong> portal on
        BIT Brand Anarchy's SEO Intelligence Platform.
      </p>
      <p style="color: #444; line-height: 1.6;">
        Click the button below to set up your account and access your SEO dashboard, reports, and keyword research.
      </p>
      <a href="${inviteUrl}"
         style="display: inline-block; margin: 20px 0; padding: 12px 24px; background: #6366f1; color: white;
                border-radius: 6px; text-decoration: none; font-weight: 600;">
        Accept Invitation
      </a>
      <p style="color: #888; font-size: 13px;">
        This invitation link expires in 7 days. If you did not expect this email, you can safely ignore it.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 12px;">BIT Brand Anarchy SEO Intelligence Portal</p>
    </div>
  `;

  if (!process.env.RESEND_API_KEY) {
    console.log("\n📧 [POC Email — no RESEND_API_KEY set]");
    console.log("  To:", to);
    console.log("  Subject:", subject);
    console.log("  Invite URL:", inviteUrl);
    console.log("  Client:", clientName, "\n");
    return;
  }

  await sendViaResend({ from: FROM_ADDRESS, to, subject, html });
}

export async function sendReportPublishedEmail({ to, reportTitle, portalUrl }: ReportEmailParams): Promise<void> {
  const subject = `New report available: ${reportTitle}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 22px; color: #111;">Your latest SEO report is ready</h1>
      <p style="color: #444; line-height: 1.6;">
        A new report has been published for you: <strong>${reportTitle}</strong>.
      </p>
      <p style="color: #444; line-height: 1.6;">
        Log in to your portal to view your full SEO performance summary, including traffic,
        keyword rankings, backlink profile, and AI visibility metrics.
      </p>
      <a href="${portalUrl}"
         style="display: inline-block; margin: 20px 0; padding: 12px 24px; background: #6366f1; color: white;
                border-radius: 6px; text-decoration: none; font-weight: 600;">
        View Report
      </a>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 12px;">BIT Brand Anarchy SEO Intelligence Portal</p>
    </div>
  `;

  if (!process.env.RESEND_API_KEY) {
    console.log("\n📧 [POC Email — no RESEND_API_KEY set]");
    console.log("  To:", to);
    console.log("  Subject:", subject);
    console.log("  Portal URL:", portalUrl, "\n");
    return;
  }

  await sendViaResend({ from: FROM_ADDRESS, to, subject, html });
}

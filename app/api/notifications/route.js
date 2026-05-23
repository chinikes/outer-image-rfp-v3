/**
 * POST /api/notifications
 *
 * Sends notifications when proposal drafts are ready.
 * Supports email (via Resend or SMTP) and Slack webhook.
 * Called by n8n when status changes to "Ready for Review".
 *
 * Environment variables:
 *   NOTIFICATION_EMAIL     - recipient email address
 *   SLACK_WEBHOOK_URL      - Slack incoming webhook URL
 *   RESEND_API_KEY         - Resend API key (optional, for email)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS - SMTP config (optional fallback)
 *   NEXT_PUBLIC_APP_URL    - Portal base URL for links in notifications
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  // Verify webhook secret if configured (recommended for production)
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token !== webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const {
      recordId,
      rfpName,
      status,
      serviceLine,
      deadline,
      type = "draft_ready",
    } = body;

    if (!recordId || !rfpName) {
      return NextResponse.json(
        { error: "recordId and rfpName are required" },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://outer-image-rfp-preview-xi95.vercel.app";
    const proposalUrl = `${appUrl}/proposals/${recordId}`;

    const results = {
      slack: null,
      email: null,
    };

    // ── Slack notification ──────────────────────────────────────────
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      try {
        const slackMessage = {
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: type === "deadline_reminder"
                  ? `⏰ Deadline Approaching: ${rfpName}`
                  : `✅ Proposal Draft Ready: ${rfpName}`,
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*RFP:*\n${rfpName}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Status:*\n${status || "Ready for Review"}`,
                },
                ...(serviceLine
                  ? [{ type: "mrkdwn", text: `*Service Line:*\n${serviceLine}` }]
                  : []),
                ...(deadline
                  ? [{ type: "mrkdwn", text: `*Deadline:*\n${deadline}` }]
                  : []),
              ],
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "View Proposal",
                  },
                  url: proposalUrl,
                  style: "primary",
                },
              ],
            },
          ],
        };

        const slackRes = await fetch(slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slackMessage),
        });

        results.slack = slackRes.ok ? "sent" : "failed";
      } catch (err) {
        console.error("Slack notification failed:", err);
        results.slack = "error";
      }
    }

    // ── Email notification (via Resend) ─────────────────────────────
    const resendApiKey = process.env.RESEND_API_KEY;
    const notificationEmail = process.env.NOTIFICATION_EMAIL;

    if (resendApiKey && notificationEmail) {
      try {
        const subject = type === "deadline_reminder"
          ? `⏰ Deadline Approaching: ${rfpName}`
          : `✅ Proposal Draft Ready: ${rfpName}`;

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #0F2027; padding: 20px 30px; border-bottom: 4px solid #2C7A7B;">
              <h1 style="color: white; font-size: 20px; margin: 0;">OUTER IMAGE LLC</h1>
              <p style="color: #4FD1C5; font-size: 12px; margin: 4px 0 0;">RFP Portal Notification</p>
            </div>
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #0F2027; font-size: 18px; margin: 0 0 15px;">${subject}</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #718096; font-size: 13px; width: 120px;">RFP Name</td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px; font-weight: 600;">${rfpName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #718096; font-size: 13px;">Status</td>
                  <td style="padding: 8px 0; color: #333; font-size: 14px;">${status || "Ready for Review"}</td>
                </tr>
                ${serviceLine ? `<tr><td style="padding: 8px 0; color: #718096; font-size: 13px;">Service Line</td><td style="padding: 8px 0; color: #333; font-size: 14px;">${serviceLine}</td></tr>` : ""}
                ${deadline ? `<tr><td style="padding: 8px 0; color: #718096; font-size: 13px;">Deadline</td><td style="padding: 8px 0; color: #333; font-size: 14px;">${deadline}</td></tr>` : ""}
              </table>
              <div style="margin-top: 20px;">
                <a href="${proposalUrl}" style="display: inline-block; background: #2C7A7B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  View Proposal
                </a>
              </div>
            </div>
            <div style="padding: 15px 30px; background: #0F2027; text-align: center;">
              <p style="color: #718096; font-size: 11px; margin: 0;">Outer Image RFP Portal — Automated Notification</p>
            </div>
          </div>
        `;

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "RFP Portal <notifications@outerimage.com>",
            to: [notificationEmail],
            subject: subject,
            html: htmlBody,
          }),
        });

        results.email = emailRes.ok ? "sent" : "failed";
      } catch (err) {
        console.error("Email notification failed:", err);
        results.email = "error";
      }
    }

    const anySent = results.slack === "sent" || results.email === "sent";

    return NextResponse.json({
      success: true,
      notificationsSent: anySent,
      results,
      proposalUrl,
    });
  } catch (error) {
    console.error("Notification error:", error);
    return NextResponse.json(
      { error: "Failed to send notifications" },
      { status: 500 }
    );
  }
}

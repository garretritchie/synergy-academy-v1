/* eslint-disable @typescript-eslint/no-explicit-any */
type EmailRecipient = { email: string; userId?: string | null };

export type AcademyEmail = {
  type: string;
  recipients: EmailRecipient[];
  subject: string;
  html: string;
  text: string;
  relatedTable?: string;
  relatedId?: string;
  requestedBy?: string;
};

export async function deliverAcademyEmail(serviceClient: any, message: AcademyEmail) {
  const { data: settingRow } = await serviceClient
    .from("platform_settings")
    .select("value")
    .eq("key", "email_delivery")
    .maybeSingle();
  const settings = settingRow?.value ?? {};
  const enabled = settings.enabled === true;
  const apiKey = Deno.env.get("SMTP2GO_API_KEY");
  const recipients = Array.from(
    new Map(
      message.recipients
        .filter((recipient) => recipient.email)
        .map((recipient) => [recipient.email.toLowerCase(), recipient]),
    ).values(),
  );
  if (!recipients.length) return { sent: 0, failed: 0, suppressed: false };

  if (!enabled || !apiKey) {
    await logDelivery(serviceClient, message, recipients, "suppressed", null, enabled ? "SMTP2GO secret is not configured" : "Email delivery is disabled");
    return { sent: 0, failed: 0, suppressed: true };
  }

  let sent = 0;
  let failed = 0;
  for (let index = 0; index < recipients.length; index += 50) {
    const batch = recipients.slice(index, index + 50);
    try {
      const response = await fetch("https://api.smtp2go.com/v3/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          sender: `${settings.from_name || "Synergy Academy"} <${settings.from_email || "academy@synergybahamas.com"}>`,
          to: batch.map((recipient) => recipient.email),
          subject: message.subject,
          html_body: message.html,
          text_body: message.text,
          custom_headers: [{ header: "Reply-To", value: settings.reply_to || "info@synergybahamas.com" }],
        }),
      });
      const result = await response.json();
      if (!response.ok || result?.data?.error) {
        throw new Error(result?.data?.error || `SMTP2GO returned ${response.status}`);
      }
      sent += batch.length;
      await logDelivery(serviceClient, message, batch, "sent", result?.data?.email_id || null, null);
    } catch (error) {
      failed += batch.length;
      await logDelivery(serviceClient, message, batch, "failed", null, error instanceof Error ? error.message : "Unknown delivery error");
    }
  }
  return { sent, failed, suppressed: false };
}

async function logDelivery(serviceClient: any, message: AcademyEmail, recipients: EmailRecipient[], status: "sent" | "failed" | "suppressed", providerMessageId: string | null, errorMessage: string | null) {
  await serviceClient.from("email_outbox").insert(
    recipients.map((recipient) => ({
      message_type: message.type,
      recipient_email: recipient.email,
      recipient_user_id: recipient.userId || null,
      subject: message.subject,
      related_table: message.relatedTable || null,
      related_id: message.relatedId || null,
      status,
      provider_message_id: providerMessageId,
      error_message: errorMessage,
      requested_by: message.requestedBy || null,
    })),
  );
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

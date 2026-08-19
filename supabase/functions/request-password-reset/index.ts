import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { deliverAcademyEmail } from "../_shared/email.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const generic = { accepted: true, message: "If the account is eligible, reset instructions will be sent." };
  try {
    const payload = await request.json();
    const email = String(payload.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return json(generic);
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: setting } = await service.from("platform_settings").select("value").eq("key", "email_delivery").maybeSingle();
    if (setting?.value?.enabled !== true) return json({ ...generic, suppressed: true });

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count: recentCount } = await service
      .from("email_outbox")
      .select("id", { count: "exact", head: true })
      .eq("message_type", "password_reset")
      .eq("recipient_email", email)
      .gte("created_at", twoMinutesAgo);
    if (recentCount) return json(generic);

    const { data: profile } = await service.from("profiles").select("id,first_name,email").ilike("email", email).eq("is_active", true).maybeSingle();
    if (!profile) return json(generic);
    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: payload.redirect_to },
    });
    if (linkError) throw linkError;
    const actionLink = linkData.properties.action_link;
    const body = `Hello ${profile.first_name || "there"},\n\nUse the secure link below to reset your Synergy Academy password. If you did not request this, you can ignore this message.\n\n${actionLink}`;
    await deliverAcademyEmail(service, {
      type: "password_reset",
      recipients: [{ email, userId: profile.id }],
      subject: "Reset your Synergy Academy password",
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#12233f"><h1 style="font-size:22px">Reset your password</h1><p style="line-height:1.65">Hello ${profile.first_name || "there"},</p><p style="line-height:1.65">Use the secure button below to reset your Synergy Academy password. If you did not request this, you can ignore this message.</p><p style="margin:28px 0"><a href="${actionLink}" style="background:#1268c4;color:#fff;padding:12px 18px;border-radius:7px;text-decoration:none;font-weight:bold">Reset password</a></p></div>`,
      text: body,
      relatedTable: "profiles",
      relatedId: profile.id,
    });
    return json(generic);
  } catch {
    return json(generic);
  }
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

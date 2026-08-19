/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { deliverAcademyEmail } from "../_shared/email.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let createdUserId = "";
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Authentication required");
    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: callerData } = await serviceClient.auth.getUser(authorization.replace("Bearer ", ""));
    if (!callerData.user) throw new Error("Authentication required");
    const { count: adminCount } = await serviceClient
      .from("user_roles")
      .select("id,role:roles!inner(name)", { count: "exact", head: true })
      .eq("user_id", callerData.user.id)
      .eq("role.name", "administrator");
    if (!adminCount) throw new Error("Only an administrator may create users");
    const payload = await request.json();
    if (!payload.email || !payload.password || payload.password.length < 10 || !payload.first_name || !payload.last_name) {
      throw new Error("First name, last name, email, and a temporary password of at least 10 characters are required");
    }
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    if (!roles.length || roles.some((role: string) => !["student", "instructor", "administrator"].includes(role))) {
      throw new Error("Choose one or more valid roles");
    }
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        first_name: payload.first_name.trim(),
        last_name: payload.last_name.trim(),
        must_change_password: true,
      },
    });
    if (createError || !created.user) throw createError || new Error("User creation failed");
    createdUserId = created.user.id;
    await serviceClient.from("profiles").update({ first_name: payload.first_name.trim(), last_name: payload.last_name.trim(), is_active: true }).eq("id", createdUserId);
    const { data: roleRows, error: roleError } = await serviceClient.from("roles").select("id,name").in("name", roles);
    const resolvedRoles = roleRows ?? [];
    if (roleError || resolvedRoles.length !== roles.length) throw roleError || new Error("One or more roles could not be assigned");
    const { error: assignmentError } = await serviceClient.from("user_roles").insert(resolvedRoles.map((role: any) => ({ user_id: createdUserId, role_id: role.id })));
    if (assignmentError) throw assignmentError;
    let delivery = { sent: 0, failed: 0, suppressed: false };
    if (payload.send_welcome) {
      const body = `Hello ${payload.first_name.trim()},\n\nYour Synergy Academy account is ready. Sign in at ${payload.sign_in_url} using the temporary password provided separately. You will be required to choose a new password after signing in.`;
      delivery = await deliverAcademyEmail(serviceClient, {
        type: "welcome",
        recipients: [{ email: payload.email.trim(), userId: createdUserId }],
        subject: "Your Synergy Academy account is ready",
        html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#12233f"><h1 style="font-size:22px">Welcome to Synergy Academy</h1><div style="white-space:pre-line;line-height:1.65">${body}</div></div>`,
        text: body,
        relatedTable: "profiles",
        relatedId: createdUserId,
        requestedBy: callerData.user.id,
      });
    }
    return json({ user_id: createdUserId, email_delivery: delivery });
  } catch (error) {
    if (createdUserId) {
      const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await serviceClient.auth.admin.deleteUser(createdUserId);
    }
    return json({ error: error instanceof Error ? error.message : "User creation failed" }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

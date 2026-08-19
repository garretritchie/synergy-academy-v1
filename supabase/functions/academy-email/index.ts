/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { deliverAcademyEmail, escapeHtml } from "../_shared/email.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Authentication required");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authorization.replace("Bearer ", "");
    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication required");
    const user = userData.user;
    const { data: roleRows } = await serviceClient
      .from("user_roles")
      .select("role:roles(name)")
      .eq("user_id", user.id);
    const roles = (roleRows ?? []).map((row: any) => row.role?.name);
    const isAdmin = roles.includes("administrator");
    const isInstructor = roles.includes("instructor");
    if (!isAdmin && !isInstructor) throw new Error("Email delivery is limited to academy staff");

    const payload = await request.json();
    const resolved = await resolveMessage(serviceClient, payload, user.id, isAdmin);
    const result = await deliverAcademyEmail(serviceClient, { ...resolved, requestedBy: user.id });
    return json({ ...result, message: result.suppressed ? "Email delivery is disabled" : "Email request processed" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Email request failed" }, 400);
  }
});

async function resolveMessage(service: any, payload: any, userId: string, isAdmin: boolean) {
  if (payload.type === "announcement") {
    const { data: announcement, error } = await service.from("announcements").select("id,cohort_id,title,body").eq("id", payload.announcement_id).single();
    if (error) throw error;
    await assertCohortAccess(service, announcement.cohort_id, userId, isAdmin);
    return {
      type: "announcement",
      recipients: await cohortRecipients(service, announcement.cohort_id),
      subject: `Synergy Academy: ${announcement.title}`,
      html: template(announcement.title, announcement.body),
      text: `${announcement.title}\n\n${announcement.body}`,
      relatedTable: "announcements",
      relatedId: announcement.id,
    };
  }
  if (payload.type === "live_session_reminder") {
    const { data: session, error } = await service.from("live_sessions").select("id,cohort_id,title,scheduled_start,meeting_url,preparation_notes").eq("id", payload.live_session_id).single();
    if (error) throw error;
    await assertCohortAccess(service, session.cohort_id, userId, isAdmin);
    const when = new Date(session.scheduled_start).toLocaleString("en-BS", { dateStyle: "full", timeStyle: "short", timeZone: "America/Nassau" });
    const body = `${when}${session.preparation_notes ? `\n\nPreparation: ${session.preparation_notes}` : ""}${session.meeting_url ? `\n\nJoin: ${session.meeting_url}` : ""}`;
    return {
      type: "live_session_reminder",
      recipients: await cohortRecipients(service, session.cohort_id),
      subject: `Reminder: ${session.title}`,
      html: template(session.title, body),
      text: `${session.title}\n\n${body}`,
      relatedTable: "live_sessions",
      relatedId: session.id,
    };
  }
  if (payload.type === "assignment_reminder") {
    const { data: assignment, error } = await service.from("assignments").select("id,cohort_id,title,description,due_date").eq("id", payload.assignment_id).single();
    if (error || !assignment.cohort_id) throw error || new Error("This assignment is not linked to a cohort");
    await assertCohortAccess(service, assignment.cohort_id, userId, isAdmin);
    const due = assignment.due_date ? new Date(assignment.due_date).toLocaleString("en-BS", { dateStyle: "full", timeStyle: "short", timeZone: "America/Nassau" }) : "No due date";
    const body = `${assignment.description || "Review the assignment in Synergy Academy."}\n\nDue: ${due}`;
    return {
      type: "assignment_reminder",
      recipients: await cohortRecipients(service, assignment.cohort_id),
      subject: `Assignment reminder: ${assignment.title}`,
      html: template(assignment.title, body),
      text: `${assignment.title}\n\n${body}`,
      relatedTable: "assignments",
      relatedId: assignment.id,
    };
  }
  if (["welcome", "invitation", "test"].includes(payload.type)) {
    if (!isAdmin) throw new Error("Only an administrator may send this email");
    return {
      type: payload.type,
      recipients: [{ email: payload.email, userId: payload.user_id || null }],
      subject: payload.subject,
      html: template(payload.subject, payload.body),
      text: `${payload.subject}\n\n${payload.body}`,
    };
  }
  throw new Error("Unsupported email type");
}

async function assertCohortAccess(service: any, cohortId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return;
  const { count } = await service.from("cohort_instructors").select("id", { count: "exact", head: true }).eq("cohort_id", cohortId).eq("instructor_id", userId);
  if (!count) throw new Error("You are not assigned to this cohort");
}

async function cohortRecipients(service: any, cohortId: string) {
  const { data, error } = await service.from("enrolments").select("student_id,student:profiles!enrolments_student_id_fkey(email)").eq("cohort_id", cohortId).eq("status", "active");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ email: row.student.email, userId: row.student_id }));
}

function template(title: string, body: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#12233f"><div style="border-bottom:4px solid #1677d2;padding:20px 0"><strong>SYNERGY ACADEMY</strong></div><h1 style="font-size:22px;margin:28px 0 12px">${escapeHtml(title)}</h1><div style="font-size:15px;line-height:1.65;white-space:pre-line">${escapeHtml(body)}</div><p style="margin-top:30px;font-size:12px;color:#64748b">Skills for What’s Next. · Synergy Bahamas</p></div>`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

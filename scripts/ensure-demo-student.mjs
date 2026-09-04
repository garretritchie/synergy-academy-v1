import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function readLocalEnvironment() {
  const values = {};
  const file = path.resolve(".env.local");
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const rawValue = match[2].trim();
      values[match[1].trim()] = rawValue.replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  return values;
}

const localEnvironment = readLocalEnvironment();
const value = (...names) => {
  for (const name of names) {
    const resolved = process.env[name] || localEnvironment[name];
    if (resolved) return resolved;
  }
  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
};

const supabaseUrl = value("VITE_SUPABASE_URL");
const anonKey = value("VITE_SUPABASE_ANON_KEY");
const adminEmail = value("ACADEMY_ADMIN_EMAIL", "VITE_DEMO_ADMIN_EMAIL");
const adminPassword = value("ACADEMY_ADMIN_PASSWORD", "VITE_DEMO_ADMIN_PASSWORD");
const studentPassword = value("VITE_DEMO_STUDENT_PASSWORD");
const desiredEmail = process.env.DEMO_STUDENT_REPAIR_EMAIL || "demo.student.preview@synergybahamas.com";
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(supabaseUrl, anonKey, options);

function assertResult(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

async function main() {
  assertResult(await admin.auth.signInWithPassword({ email: adminEmail, password: adminPassword }), "Administrator sign-in");

  let profile = assertResult(
    await admin.from("profiles").select("id,email").eq("email", desiredEmail).maybeSingle(),
    "Find demo learner",
  );
  let created = false;
  if (!profile) {
    const creation = await admin.functions.invoke("admin-create-user", {
      body: {
        email: desiredEmail,
        first_name: "Demo",
        last_name: "Student",
        password: studentPassword,
        roles: ["student"],
        send_welcome: false,
        sign_in_url: "https://academy.synergybahamas.com/signin",
      },
    });
    if (creation.error || creation.data?.error) {
      throw new Error(`Create demo learner: ${creation.data?.error || creation.error.message}`);
    }
    profile = { id: creation.data.user_id, email: desiredEmail };
    created = true;
  }

  const cohort = assertResult(
    await admin.from("cohorts").select("id,course_id").eq("slug", "ai-business-essentials-preview").single(),
    "Find AI Business Essentials cohort",
  );
  assertResult(
    await admin.from("enrolments").upsert(
      {
        cohort_id: cohort.id,
        student_id: profile.id,
        status: "active",
        enrolled_at: new Date().toISOString(),
      },
      { onConflict: "cohort_id,student_id" },
    ),
    "Enrol demo learner",
  );

  const student = createClient(supabaseUrl, anonKey, options);
  assertResult(
    await student.auth.signInWithPassword({ email: desiredEmail, password: studentPassword }),
    "Verify demo learner sign-in",
  );
  assertResult(
    await student.auth.updateUser({ data: { must_change_password: false } }),
    "Mark demo learner password as ready",
  );
  console.log(JSON.stringify({ email: desiredEmail, created, cohortId: cohort.id, verified: true }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

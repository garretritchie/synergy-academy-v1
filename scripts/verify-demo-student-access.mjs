import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const environment = Object.fromEntries(
  fs
    .readFileSync(path.resolve(".env.local"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^([^#=]+)=(.*)$/))
    .filter(Boolean)
    .map((match) => [
      match[1].trim(),
      match[2].trim().replace(/^(["'])(.*)\1$/, "$2"),
    ]),
);
const client = createClient(
  environment.VITE_SUPABASE_URL,
  environment.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

const signIn = await client.auth.signInWithPassword({
  email: environment.VITE_DEMO_STUDENT_EMAIL,
  password: environment.VITE_DEMO_STUDENT_PASSWORD,
});
if (signIn.error) throw signIn.error;
const resources = await client
  .from("resources")
  .select("id,title,url")
  .eq("title", "AI Business Essentials Student Textbook");
if (resources.error) throw resources.error;
const assessments = await client
  .from("assessments")
  .select(
    "title,assessment_type,max_attempts,module:modules(title),lesson:lessons(title)",
  )
  .order("assessment_type");
if (assessments.error) throw assessments.error;
const resource = resources.data[0];
const signed = resource?.url?.startsWith("storage:")
  ? await client.storage
      .from("course-assets")
      .createSignedUrl(resource.url.slice(8), 60)
  : resource?.url
    ? { data: { signedUrl: resource.url }, error: null }
    : { data: null, error: new Error("Resource has no storage path") };
const adminClient = createClient(
  environment.VITE_SUPABASE_URL,
  environment.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
await adminClient.auth.signInWithPassword({
  email: environment.VITE_DEMO_ADMIN_EMAIL,
  password: environment.VITE_DEMO_ADMIN_PASSWORD,
});
const storagePath = resource?.url?.startsWith("storage:")
  ? resource.url.slice(8)
  : resource?.url
    ? decodeURIComponent(
        new URL(resource.url).pathname.split("/course-assets/")[1] || "",
      )
    : "";
const [courseFolder, resourceFolder] = storagePath.split("/");
const adminListing = await adminClient.storage
  .from("course-assets")
  .list(`${courseFolder}/${resourceFolder}`);
const adminSigned = storagePath
  ? await adminClient.storage
      .from("course-assets")
      .createSignedUrl(storagePath, 60)
  : { data: null, error: null };
console.log(
  JSON.stringify(
    {
      signedIn: true,
      resourcesVisible: resources.data.length,
      textbookLinkReady: Boolean(signed.data?.signedUrl),
      textbookLinkError: signed.error?.message ?? null,
      storagePath,
      objectsAtPath: adminListing.data?.map((item) => item.name) ?? [],
      listingError: adminListing.error?.message ?? null,
      adminTextbookLinkReady: Boolean(adminSigned.data?.signedUrl),
      adminTextbookLinkError: adminSigned.error?.message ?? null,
      assessmentRules: {
        moduleChecks: assessments.data
          .filter((item) => item.assessment_type === "practice")
          .map((item) => item.max_attempts),
        graded: assessments.data
          .filter((item) => item.assessment_type !== "practice")
          .map((item) => item.max_attempts),
      },
      assessmentLinksValid: assessments.data.every(
        (item) => Boolean(item.module) && Boolean(item.lesson),
      ),
    },
    null,
    2,
  ),
);

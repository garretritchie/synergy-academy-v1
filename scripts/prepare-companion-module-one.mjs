import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { moduleOne } from "../content/companion/module-01.mjs";

// Default is an offline, reviewable manifest. --apply requires an explicit target and admin login.
// Never read existing demo credentials or choose a production cohort automatically.
const args = process.argv.slice(2);
const option = (name) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const root = path.resolve(
  option("--assets") ?? "private/course-content/module-01",
);
const files = moduleOne.assets.map((asset) => {
  const file = path.join(root, asset.file);
  const bytes = fs.readFileSync(file);
  return {
    ...asset,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
});
const manifest = {
  ...moduleOne,
  assets: files,
  liveSession: null,
  status: "Prepared for instructor review; no live schedule supplied",
};
fs.mkdirSync("private/course-content", { recursive: true });
fs.writeFileSync(
  "private/course-content/module-01-manifest.json",
  JSON.stringify(manifest, null, 2),
);
console.log(
  `Prepared ${files.length} verified assets, ${moduleOne.recap.length} recap pages, one activity and ${moduleOne.assessment.questions.length} draft questions.`,
);
if (!args.includes("--apply")) {
  console.log(
    "Offline manifest: private/course-content/module-01-manifest.json. No network calls or database changes.",
  );
  process.exit(0);
}
const cohort = option("--cohort"),
  moduleId = option("--module");
if (!cohort || !moduleId)
  throw new Error("--apply requires explicit --cohort and --module UUIDs.");
for (const key of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "COMPANION_ADMIN_EMAIL",
  "COMPANION_ADMIN_PASSWORD",
]) {
  if (!process.env[key])
    throw new Error(`Set ${key} in the process environment.`);
}
const client = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const checked = async (request, label) => {
  const result = await request;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
await checked(
  client.auth.signInWithPassword({
    email: process.env.COMPANION_ADMIN_EMAIL,
    password: process.env.COMPANION_ADMIN_PASSWORD,
  }),
  "Administrator sign-in",
);
const roles = await checked(client.rpc("get_user_roles"), "Role check");
if (!roles.includes("administrator"))
  throw new Error("This content import requires administrator access.");
const delivery = await checked(
  client
    .from("cohorts")
    .select("id,course_id,metadata")
    .eq("id", cohort)
    .single(),
  "Cohort",
);
await checked(
  client
    .from("modules")
    .select("id")
    .eq("id", moduleId)
    .eq("course_id", delivery.course_id)
    .single(),
  "Module belongs to course",
);
const enrolled = await checked(
  client
    .from("enrolments")
    .select("id,cohort:cohorts!inner(course_id)")
    .eq("cohort.course_id", delivery.course_id)
    .limit(1),
  "Staging course check",
);
if (enrolled.length)
  throw new Error(
    "Use an empty staging course for this first content import. Existing live deliveries require a reviewed mapping.",
  );
// Stable resource/lesson IDs make interrupted uploads safely resumable without duplicating records.
const id = (key) => {
  const h = createHash("sha256")
    .update(`${moduleOne.key}:${moduleId}:${key}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const lessonId = id("recap");
const existing = await checked(
  client.from("lesson_blocks").select("id").eq("lesson_id", lessonId),
  "Existing recap",
);
if (existing.length)
  throw new Error(
    "This module package already has recap pages. Review/update it in the studio; automatic reimport is blocked to protect student records.",
  );
await checked(
  client.rpc("companion_initialize", { cohort_uuid: cohort }),
  "Component templates",
);
const components = await checked(
  client.from("module_components").select("*").eq("module_id", moduleId),
  "Components",
);
if (components.some((c) => c.is_published))
  throw new Error(
    "Import into unpublished components only. Existing published delivery is never overwritten.",
  );
for (const asset of files) {
  const resourceId = id(asset.key),
    objectPath = `${delivery.course_id}/${resourceId}/${asset.file}`;
  await checked(
    client.from("resources").upsert({
      id: resourceId,
      course_id: delivery.course_id,
      module_id: moduleId,
      title: asset.title,
      description: `Supplied Module 1 source · SHA-256 ${asset.sha256}`,
      resource_type: asset.type,
      url: `storage:${objectPath}`,
      file_size: asset.bytes,
      is_downloadable: true,
    }),
    `Resource ${asset.key}`,
  );
  await checked(
    client.storage
      .from("course-assets")
      .upload(objectPath, fs.readFileSync(path.join(root, asset.file)), {
        contentType: asset.mime,
        upsert: true,
      }),
    `Upload ${asset.key}`,
  );
}
await checked(
  client.from("lessons").upsert({
    id: lessonId,
    module_id: moduleId,
    title: "Module 1 — eBook recap v4.4",
    is_published: true,
    display_order: 1000,
  }),
  "Recap lesson",
);
await checked(
  client.from("lesson_blocks").upsert(
    moduleOne.recap.map((page, i) => ({
      id: id(`page-${i + 1}`),
      lesson_id: lessonId,
      block_type: "storyboard_screen",
      display_order: i + 1,
      content: {
        ...page,
        type: "concept",
        eyebrow: `eBook v4.4 · supplied PDF page ${page.page}`,
      },
    })),
  ),
  "Recap pages",
);
const activityId = await checked(
  client.rpc("companion_author_item", {
    cohort_uuid: cohort,
    module_uuid: moduleId,
    item_kind: "activity",
    item_data: moduleOne.activity,
  }),
  "Activity",
);
const assessmentId = await checked(
  client.rpc("companion_author_item", {
    cohort_uuid: cohort,
    module_uuid: moduleId,
    item_kind: "assessment",
    item_data: moduleOne.assessment,
  }),
  "Assessment",
);
for (const component of components) {
  const targets =
    component.type === "activity"
      ? [activityId]
      : component.type === "assessment"
        ? [assessmentId]
        : [];
  await checked(
    client.rpc("companion_save_component", {
      cohort_uuid: cohort,
      component_uuid: component.id,
      component_data: {
        ...component,
        is_published: false,
        lesson_id: component.type === "ebook_recap" ? lessonId : null,
        resource_id: ["audio", "video"].includes(component.type)
          ? id(component.type)
          : null,
      },
      target_ids: targets,
    }),
    `Configure ${component.type}`,
  );
}
await client.auth.signOut();
console.log(
  "Imported draft materials. Review and publish in the studio, configure the actual live session, then explicitly enable v2/release. Grade weights and existing academic records are unchanged.",
);

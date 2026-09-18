// Isolated local UI fixtures. This never signs in to or modifies a hosted database.
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import assert from "node:assert/strict";
import { moduleOne } from "../content/companion/module-01.mjs";
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require(
    process.env.PLAYWRIGHT_PATH ??
      "C:/Users/garre/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  ));
}
const base = process.env.COMPANION_PREVIEW_URL ?? "http://127.0.0.1:5182";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))
  throw new Error("Local preview only.");
const browser = await chromium.launch({ headless: true, channel: "msedge" });
const context = await browser.newContext();
context.setDefaultTimeout(15000);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const user = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "student@example.invalid",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};
const token = [
  "eyJhbGciOiJIUzI1NiJ9",
  Buffer.from(
    JSON.stringify({
      sub: user.id,
      exp: Math.floor(Date.now() / 1000) + 3600,
      role: "authenticated",
    }),
  ).toString("base64url"),
  "fixture",
].join(".");
await context.addInitScript(
  ({ token, user }) =>
    localStorage.setItem(
      "sb-127-auth-token",
      JSON.stringify({
        access_token: token,
        refresh_token: "fixture",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: "bearer",
        user,
      }),
    ),
  { token, user },
);
const types = [
  "ebook_recap",
  "video",
  "audio",
  "activity",
  "assessment",
  "resources",
  "live_session",
];
const titles = [
  "eBook Recap",
  "Video Explainer",
  "Audio Recap",
  "Activities",
  "Assessment",
  "Resources",
  "Live Class",
];
const components = types.map((type, i) => ({
  id: `component-${i}`,
  module_id: "module-1",
  title: titles[i],
  type,
  required: type !== "resources",
  status: "not_started",
  is_published: true,
  lesson_id: type === "ebook_recap" ? "lesson-1" : null,
  resource_id: ["video", "audio"].includes(type) ? type : null,
  requires_pass: true,
}));
const outline = {
  enrolment_id: "enrolment-1",
  enabled: true,
  modules: [
    {
      id: "module-1",
      title: "Module 1: AI foundations",
      description: "Understand the tools. Keep responsibility with people.",
      available: true,
      components,
      display_order: 1,
      release_at: null,
    },
    {
      id: "module-2",
      title: "Module 2: Clear prompts",
      available: false,
      components: components.map((c) => ({ ...c, id: `next-${c.id}` })),
      display_order: 2,
      release_at: null,
    },
  ],
};
const course = {
  id: "cohort-1",
  name: "Local QA cohort",
  course_id: "course-1",
  metadata: { companion_v2: true },
  course: {
    title: "AI Business Essentials",
    description: "Practical AI skills for the workplace.",
    introduction_video_url: null,
  },
};
const resources = moduleOne.assets.map((a) => ({
  id: a.key,
  title: a.title,
  module_id: "module-1",
  course_id: "course-1",
  description: "Supplied Module 1 material",
  resource_type: a.type,
  url: `http://127.0.0.1:54330/${a.file}`,
  is_downloadable: true,
}));
const progress = {};
let result = null;
const questions = moduleOne.assessment.questions.slice(0, 3).map((q, i) => ({
  ...q,
  id: `question-${i}`,
  correct_answer: undefined,
  explanation: undefined,
}));
const grades = { items: [], current_grade: null, graded_count: 0, total: 0 };
let role = "student";
const assets = http.createServer((request, response) => {
  const file = decodeURIComponent(
    new URL(request.url, "http://localhost").pathname.slice(1),
  );
  const asset = moduleOne.assets.find((a) => a.file === file);
  if (!asset) {
    response.writeHead(404).end();
    return;
  }
  const disk = `private/course-content/module-01/${file}`;
  const size = fs.statSync(disk).size;
  const range = request.headers.range?.match(/bytes=(\d+)-(\d*)/);
  const start = range ? Number(range[1]) : 0;
  const end =
    range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  response.writeHead(range ? 206 : 200, {
    "Content-Type": asset.mime,
    "Content-Length": end - start + 1,
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  });
  fs.createReadStream(disk, { start, end }).pipe(response);
});
await new Promise((resolve) => assets.listen(54330, "127.0.0.1", resolve));
await page.route("http://127.0.0.1:54329/**", async (route) => {
  const url = new URL(route.request().url());
  const endpoint = url.pathname.split("/").at(-1);
  const body = route.request().postDataJSON();
  let data = [];
  if (url.pathname.startsWith("/auth/")) data = user;
  else if (endpoint === "profiles")
    data = {
      ...user,
      first_name: "Jordan",
      last_name: "Reed",
      is_active: true,
    };
  else if (endpoint === "get_user_roles") data = [role];
  else if (endpoint === "enrolments")
    data = [
      { id: "enrolment-1", cohort_id: "cohort-1", cohort: course },
      {
        id: "enrolment-2",
        cohort_id: "cohort-2",
        cohort: {
          ...course,
          id: "cohort-2",
          name: "Second cohort",
          course: { ...course.course, title: "Second course QA" },
        },
      },
    ];
  else if (endpoint === "companion_outline") data = outline;
  else if (endpoint === "companion_gradebook") data = grades;
  else if (endpoint === "get_available_course_resources") data = resources;
  else if (endpoint === "module_components")
    data =
      components.find((c) => `eq.${c.id}` === url.searchParams.get("id")) ??
      components;
  else if (endpoint === "component_bindings")
    data = [
      {
        id: "binding-1",
        assignment_id: "activity-1",
        assessment_id: "assessment-1",
        live_session_id: null,
      },
    ];
  else if (endpoint === "component_progress")
    data = progress[url.searchParams.get("component_id")?.slice(3)] ?? null;
  else if (endpoint === "companion_save_progress") {
    progress[body.component_uuid] = {
      position: body.new_position,
      status: body.complete ? "completed" : "in_progress",
    };
    components.find((c) => c.id === body.component_uuid).status =
      progress[body.component_uuid].status;
    data = null;
  } else if (endpoint === "lesson_blocks")
    data = moduleOne.recap.map((p, i) => ({
      id: `page-${i}`,
      block_type: "storyboard_screen",
      display_order: i,
      content: {
        ...p,
        type: "concept",
        eyebrow: `eBook v4.4 · PDF page ${p.page}`,
      },
    }));
  else if (endpoint === "assignments")
    data = [
      {
        id: "activity-1",
        title: moduleOne.activity.title,
        description: moduleOne.activity.instructions,
        evidence_required: true,
        evidence_instructions: moduleOne.activity.evidence,
        allow_file_upload: true,
        max_file_size_mb: 25,
        allowed_file_types: ["pdf", "png"],
        submissions: [],
        max_points: 100,
      },
    ];
  else if (endpoint === "assessments")
    data = [{ id: "assessment-1", ...moduleOne.assessment }];
  else if (endpoint === "begin_assessment_session")
    data = { id: "session-1", answers: {} };
  else if (endpoint === "get_assessment_for_student")
    data = { id: "assessment-1", ...moduleOne.assessment, questions };
  else if (endpoint === "companion_save_answer") data = null;
  else if (endpoint === "submit_assessment_attempt")
    data = result = { percentage: 100, passed: true, score: 3, max_score: 3 };
  else if (endpoint === "review_assessment_session") data = { result };
  else if (endpoint === "cohort_instructors") data = [{ cohort: course }];
  else if (endpoint === "cohorts") data = [course];
  else if (endpoint === "modules") data = outline.modules;
  else if (endpoint === "module_releases")
    data = url.searchParams.get("module_id") ? { mode: "locked" } : null;
  else if (endpoint === "companion_staff_roster")
    data = [
      {
        id: "enrolment-1",
        name: "Jordan Reed",
        email: user.email,
        outline,
        grades,
      },
    ];
  const single = route
    .request()
    .headers()
    ["accept"]?.includes("vnd.pgrst.object");
  if (single && Array.isArray(data)) data = data[0] ?? null;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*", "content-range": "0-0/0" },
    body: JSON.stringify(data),
  });
});
fs.mkdirSync("tmp/companion-qa", { recursive: true });
async function capture(name, path, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(base + path);
  await page.locator("h1").waitFor();
  await page.waitForTimeout(400);
  if (name === "audio-mobile" || name === "video-mobile") {
    const selector = name.startsWith("audio") ? "audio" : "video";
    await page.waitForFunction((s) => {
      const media = document.querySelector(s);
      return media && media.duration > 0;
    }, selector);
  }
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
    `${name} overflow`,
  );
  await page.locator("#main-content").evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({
    path: `tmp/companion-qa/${name}.png`,
    fullPage: true,
  });
}
try {
  await page.goto(base + "/student?cohort=cohort-2");
  await page.getByText("Second course QA", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Grades", exact: true }).click();
  await page.getByText("Second course QA", { exact: true }).waitFor();
  await page.goto(base + "/student?cohort=cohort-1");
  await capture("dashboard-desktop", "/student");
  await page.getByRole("link", { name: "Continue Module" }).click();
  await page.getByText("Module checklist").waitFor();
  assert.equal(
    await page.locator("video,audio,textarea,iframe").count(),
    0,
    "Overview embeds no component bodies",
  );
  await capture("dashboard-tablet", "/student", 768);
  await capture("dashboard-mobile", "/student", 390);
  await capture(
    "module-mobile",
    "/student/courses/cohort-1/modules/module-1",
    390,
  );
  for (let i = 0; i < types.length; i++)
    await capture(
      `${types[i]}-mobile`,
      `/student/courses/cohort-1/modules/module-1/components/component-${i}`,
      390,
    );
  await page.goto(
    base + "/student/courses/cohort-1/modules/module-1/components/component-0",
  );
  for (let i = 1; i < moduleOne.recap.length; i++) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByText(`Page ${i + 1} of 13`, { exact: false }).waitFor();
  }
  await page.getByRole("button", { name: "Complete recap" }).click();
  await page.getByRole("button", { name: "Recap completed" }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Recap completed" }).waitFor();
  assert.equal(progress["component-0"].status, "completed");
  assert.equal(progress["component-2"], undefined, "Audio independent");
  await capture(
    "locked-mobile",
    "/student/courses/cohort-1/modules/module-2",
    390,
  );
  await page.getByText("This module is locked").waitFor();
  await page.goto(
    base + "/student/courses/cohort-1/modules/module-1/components/component-4",
  );
  await page.getByRole("button", { name: "Start or resume" }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("radio").first().check();
    await page.waitForTimeout(100);
    if (i < 2)
      await page.getByRole("button", { name: "Next question" }).click();
  }
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await page.getByText("Assessment complete").waitFor();
  role = "instructor";
  await capture("instructor-desktop", "/instructor");
  await capture("studio-mobile", "/instructor/modules", 390);
  assert.deepEqual(errors, []);
  console.log(
    "PASS local fixture browser: desktop/mobile, all seven dedicated screens, overview isolation, recap persistence and independent progress, locked module, assessment flow, instructor dashboard/studio; no horizontal overflow or runtime errors.",
  );
} finally {
  await browser.close();
  assets.closeAllConnections();
  assets.close();
}

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
const required = (name) => {
  const value = process.env[name] || localEnvironment[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const requiredAny = (...names) => {
  for (const name of names) {
    const value = process.env[name] || localEnvironment[name];
    if (value) return value;
  }
  throw new Error(
    `Missing required environment variable: ${names.join(" or ")}`,
  );
};

const content = JSON.parse(
  fs.readFileSync(
    path.resolve("src/content/ai-business-essentials.json"),
    "utf8",
  ),
);
const client = createClient(
  required("VITE_SUPABASE_URL"),
  required("VITE_SUPABASE_ANON_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

function assertResult(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

async function findOne(table, match, columns = "*") {
  let query = client.from(table).select(columns);
  for (const [column, value] of Object.entries(match))
    query = query.eq(column, value);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Read ${table}: ${error.message}`);
  return data;
}

async function ensureRow(table, match, values) {
  const current = await findOne(table, match);
  if (current) {
    return assertResult(
      await client
        .from(table)
        .update(values)
        .eq("id", current.id)
        .select()
        .single(),
      `Update ${table}`,
    );
  }
  return assertResult(
    await client
      .from(table)
      .insert({ ...match, ...values })
      .select()
      .single(),
    `Create ${table}`,
  );
}

function dueDate(days, hour = 23) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  value.setHours(hour, 59, 0, 0);
  return value.toISOString();
}

function assignmentDescription(item) {
  return [
    "Instructions",
    ...item.instructions.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Before you submit",
    ...item.checklist.map((step) => `- ${step}`),
  ].join("\n");
}

function activityDescription(item) {
  return [
    "Directions",
    ...item.instructions.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Self-check",
    ...item.selfCheck.map((step) => `- ${step}`),
  ].join("\n");
}

async function main() {
  const login = await client.auth.signInWithPassword({
    email: requiredAny("ACADEMY_ADMIN_EMAIL", "VITE_DEMO_ADMIN_EMAIL"),
    password: requiredAny("ACADEMY_ADMIN_PASSWORD", "VITE_DEMO_ADMIN_PASSWORD"),
  });
  const adminUser = assertResult(login, "Administrator sign-in").user;
  const roles = assertResult(
    await client.rpc("get_user_roles"),
    "Read administrator roles",
  );
  if (!roles.includes("administrator")) {
    throw new Error("The supplied account is not an administrator.");
  }

  let course = await findOne("courses", { slug: "ai-business-essentials" });
  if (!course) {
    course = await findOne("courses", {
      slug: "fundamentals-ai-business-professionals-demo",
    });
  }
  if(course) throw new Error("This bootstrap seed is for a new course only. To update an existing course without deleting grades or question history, apply migrations 023–025 from GitHub in Bolt.new.");
  const courseValues = {
    title: content.course.title,
    slug: "ai-business-essentials",
    short_description: content.course.description,
    description: `${content.course.subtitle}. ${content.course.description}`,
    cover_image_url: "/demo/fundamentals-ai-business-cover.png",
    duration_weeks: 12,
    difficulty_level: "beginner",
    language: "en",
    is_published: true,
    is_self_paced: true,
    created_by: course?.created_by || adminUser.id,
    metadata: {
      course_id: content.course.id,
      curriculum_version: content.course.version,
      module_count: content.modules.length,
      learning_module_count: content.modules.length,
      screen_count: content.modules.reduce(
        (total, module) => total + module.screens.length,
        0,
      ),
      delivery: "eLearning or hybrid",
      grading: content.course.grading,
      scale: content.course.scale,
      completion: {
        require_all_lessons: true,
        require_assignments: false,
        require_assessments: true,
        min_grade: 60,
      },
    },
  };
  if (course) {
    course = assertResult(
      await client
        .from("courses")
        .update(courseValues)
        .eq("id", course.id)
        .select()
        .single(),
      "Update AI Business Essentials",
    );
  } else {
    course = assertResult(
      await client.from("courses").insert(courseValues).select().single(),
      "Create AI Business Essentials",
    );
  }

  let cohort = await findOne("cohorts", {
    course_id: course.id,
    slug: "ai-business-essentials-preview",
  });
  if (!cohort)
    cohort = await findOne("cohorts", {
      course_id: course.id,
      slug: "demo-preview",
    });
  const cohortValues = {
    name: "AI Business Essentials Academy Cohort",
    slug: "ai-business-essentials-preview",
    description:
      "Complete B1-101 eLearning, assessments, activities, assignments, and capstone workspace.",
    start_date: new Date().toISOString().slice(0, 10),
    enrolment_open: false,
    max_students: 100,
    is_active: true,
    created_by: adminUser.id,
    metadata: { curriculum_version: content.course.version },
  };
  if (cohort) {
    cohort = assertResult(
      await client
        .from("cohorts")
        .update(cohortValues)
        .eq("id", cohort.id)
        .select()
        .single(),
      "Update AI Business Essentials cohort",
    );
  } else {
    cohort = assertResult(
      await client
        .from("cohorts")
        .insert({ course_id: course.id, ...cohortValues })
        .select()
        .single(),
      "Create AI Business Essentials cohort",
    );
  }
  assertResult(
    await client
      .from("cohort_instructors")
      .upsert(
        { cohort_id: cohort.id, instructor_id: adminUser.id, is_lead: true },
        { onConflict: "cohort_id,instructor_id" },
      ),
    "Assign course instructor",
  );

  await client
    .from("modules")
    .update({ is_published: false })
    .eq("course_id", course.id);
  await client
    .from("assessments")
    .update({ is_published: false })
    .eq("cohort_id", cohort.id);
  await client
    .from("assignments")
    .update({ is_published: false })
    .eq("cohort_id", cohort.id);
  const moduleRows = new Map();
  const lessonRows = new Map();
  for (const moduleContent of content.modules) {
    const module = await ensureRow(
      "modules",
      { course_id: course.id, display_order: moduleContent.order },
      {
        title: moduleContent.title,
        description: moduleContent.description,
        is_published: true,
        metadata: {
          content_key: moduleContent.id,
          screen_count: moduleContent.screens.length,
          is_introduction: moduleContent.id === "introduction",
        },
      },
    );
    moduleRows.set(moduleContent.id, module);
    await client
      .from("lessons")
      .update({ is_published: false })
      .eq("module_id", module.id);
    const lesson = await ensureRow(
      "lessons",
      { module_id: module.id, display_order: 1 },
      {
        title:
          moduleContent.id === "introduction"
            ? "Course Introduction"
            : `${moduleContent.title} eLearning`,
        description: moduleContent.description,
        estimated_minutes: moduleContent.estimatedMinutes,
        is_published: true,
        is_free_preview: false,
        metadata: {
          content_key: moduleContent.id,
          screen_count: moduleContent.screens.length,
          completion_destination:
            moduleContent.id === "introduction"
              ? "module-01"
              : `${moduleContent.id}-check`,
        },
      },
    );
    lessonRows.set(moduleContent.id, lesson);
    assertResult(
      await client.from("lesson_blocks").delete().eq("lesson_id", lesson.id),
      `Refresh ${moduleContent.title} screens`,
    );
    assertResult(
      await client.from("lesson_blocks").insert(
        moduleContent.screens.map((screen, index) => ({
          lesson_id: lesson.id,
          block_type: "storyboard_screen",
          content: { ...screen, part_id: screen.id },
          display_order: index + 1,
        })),
      ),
      `Create ${moduleContent.title} screens`,
    );
  }

  const assessmentRows = new Map();
  for (const item of content.assessments) {
    const module = moduleRows.get(item.unlockModule);
    const lesson = lessonRows.get(item.unlockModule);
    const assessment = await ensureRow(
      "assessments",
      { cohort_id: cohort.id, title: item.title },
      {
        module_id: module.id,
        lesson_id: lesson.id,
        description:
          item.kind === "module_check"
            ? "A 10-question check of the learning module. Complete the module first."
            : `A graded ${item.questions.length}-question assessment. Complete the required learning first.`,
        assessment_type:
          item.kind === "module_check"
            ? "practice"
            : item.kind === "midterm" || item.kind === "final"
              ? "exam"
              : "quiz",
        instructions:
          "Choose the best answer for every question. Review your work before you submit.",
        time_limit_minutes:
          item.kind === "final"
            ? 75
            : item.kind === "midterm"
              ? 50
              : Math.max(15, item.questions.length * 2),
        max_attempts: item.kind === "module_check" ? 2147483647 : 1,
        passing_score: item.passingScore,
        is_published: true,
        shuffle_questions: false,
        show_results_immediately: true,
        created_by: adminUser.id,
      },
    );
    assessmentRows.set(item.id, assessment);
    assertResult(
      await client
        .from("assessment_questions")
        .delete()
        .eq("assessment_id", assessment.id),
      `Refresh ${item.title} questions`,
    );
    assertResult(
      await client.from("assessment_questions").insert(
        item.questions.map((question, index) => ({
          assessment_id: assessment.id,
          question_type: question.type ?? "multiple_choice",
          question_text: question.question,
          options: question.options,
          correct_answer: question.answer,
          explanation: question.explanation,
          points: 1,
          display_order: index + 1,
        })),
      ),
      `Create ${item.title} questions`,
    );
  }

  const activityRows = [];
  for (const item of content.activities) {
    const assignment = await ensureRow(
      "assignments",
      { cohort_id: cohort.id, title: item.title },
      {
        module_id: moduleRows.get(item.module).id,
        lesson_id: lessonRows.get(item.module).id,
        description: activityDescription(item),
        assignment_type: "activity",
        max_points: 0,
        weight: 0,
        due_date: null,
        allow_late_submission: true,
        allow_file_upload: false,
        max_attempts: 1,
        is_published: true,
        created_by: adminUser.id,
      },
    );
    activityRows.push(assignment);
  }

  const dueOffsets = [14, 35, 56, 77, 28, 70, 84, 86];
  const assignmentRows = new Map();
  for (const [index, item] of content.assignments.entries()) {
    const assignment = await ensureRow(
      "assignments",
      { cohort_id: cohort.id, title: item.title },
      {
        module_id: moduleRows.get(item.module).id,
        lesson_id: lessonRows.get(item.module).id,
        description: assignmentDescription(item),
        assignment_type: item.type,
        max_points: item.points,
        weight: item.weight,
        due_date: dueDate(dueOffsets[index]),
        allow_late_submission: true,
        allow_file_upload: true,
        allowed_file_types: [
          "pdf",
          "docx",
          "pptx",
          "xlsx",
          "png",
          "jpg",
          "txt",
        ],
        max_file_size_mb: 25,
        max_attempts: 3,
        is_published: true,
        created_by: adminUser.id,
      },
    );
    assignmentRows.set(item.id, assignment);
  }

  // This seed replaces the retired demo course grading structure for this one
  // cohort. Removing the scoped categories also removes its obsolete demo
  // grade items and sample grades before the official B1-101 weights are added.
  assertResult(
    await client.from("grade_categories").delete().eq("cohort_id", cohort.id),
    "Replace retired demo grade categories",
  );

  const gradeCategoryRows = new Map();
  for (const [name, weight, displayOrder] of [
    ["Homework", 10, 1],
    ["Quizzes", 40, 2],
    ["Presentations", 20, 3],
    ["Final Exam", 30, 4],
  ]) {
    const category = await ensureRow(
      "grade_categories",
      { cohort_id: cohort.id, name },
      {
        description: `${name} category for the official B1-101 grading plan.`,
        weight,
        drop_lowest: 0,
        display_order: displayOrder,
      },
    );
    gradeCategoryRows.set(name, category);
  }

  const gradedItems = [
    ...["homework-1", "homework-2", "homework-3", "homework-4"].map(
      (id, index) => ({
        category: "Homework",
        assignment: assignmentRows.get(id),
        assessment: null,
        name: content.assignments.find((item) => item.id === id).title,
        maxPoints: 100,
        displayOrder: index + 1,
      }),
    ),
    ...["graded-quiz-1", "midterm-exam", "graded-quiz-3"].map((id, index) => ({
      category: "Quizzes",
      assignment: null,
      assessment: assessmentRows.get(id),
      name: content.assessments.find((item) => item.id === id).title,
      maxPoints: content.assessments.find((item) => item.id === id).questions
        .length,
      displayOrder: index + 1,
    })),
    {
      category: "Presentations",
      assignment: assignmentRows.get("capstone-presentation"),
      assessment: null,
      name: "Capstone Presentation",
      maxPoints: 100,
      displayOrder: 1,
    },
    {
      category: "Final Exam",
      assignment: null,
      assessment: assessmentRows.get("final-exam"),
      name: "Final Exam: AI Business Essentials",
      maxPoints: content.assessments.find((item) => item.id === "final-exam")
        .questions.length,
      displayOrder: 1,
    },
  ];
  for (const item of gradedItems) {
    const match = item.assignment
      ? { assignment_id: item.assignment.id }
      : { assessment_id: item.assessment.id };
    await ensureRow("grade_items", match, {
      grade_category_id: gradeCategoryRows.get(item.category).id,
      assignment_id: item.assignment?.id ?? null,
      assessment_id: item.assessment?.id ?? null,
      name: item.name,
      max_points: item.maxPoints,
      due_date: item.assignment?.due_date ?? null,
      display_order: item.displayOrder,
    });
  }

  await ensureRow(
    "announcements",
    { cohort_id: cohort.id, title: "Welcome to AI Business Essentials" },
    {
      body: "Begin with the Introduction module. It explains the course, grading, safety rules, and the four course areas. When you finish it, continue directly to Module 1.",
      is_pinned: true,
      is_published: true,
      author_id: adminUser.id,
      published_at: new Date().toISOString(),
    },
  );

  assertResult(
    await client
      .from("announcements")
      .delete()
      .eq("cohort_id", cohort.id)
      .eq("title", "Welcome to the demo learning space"),
    "Remove retired demo announcement",
  );

  await ensureRow(
    "discussions",
    { cohort_id: cohort.id, title: "Welcome to AI Business Essentials" },
    {
      module_id: moduleRows.get(0)?.id ?? null,
      lesson_id: lessonRows.get(0)?.id ?? null,
      body: "Introduce yourself and share one work task you hope AI can help you improve. Do not post private, confidential, or customer information.",
      is_pinned: true,
      is_locked: false,
      author_id: adminUser.id,
      is_question: false,
      is_resolved: false,
    },
  );

  const ebookPath =
    process.env.AI_BUSINESS_EBOOK_PATH ||
    localEnvironment.AI_BUSINESS_EBOOK_PATH ||
    path.resolve(
      "..",
      "AI Class",
      "Deliverables",
      "01_Student_Materials",
      "Complete_Ebook",
      "New_Blueprint_v3.8",
      "AI_Business_Essentials_Complete_Student_Textbook_v3.8.pdf",
    );
  if (!fs.existsSync(ebookPath)) {
    throw new Error(`Student textbook not found: ${ebookPath}`);
  }
  const ebookResource = await ensureRow(
    "resources",
    { course_id: course.id, title: "AI Business Essentials Student Textbook" },
    {
      module_id: null,
      lesson_id: null,
      description:
        "The complete course eBook, available as a PDF for reading or download.",
      resource_type: "eBook",
      url: null,
      file_size: fs.statSync(ebookPath).size,
      is_downloadable: true,
      display_order: 1,
    },
  );
  const ebookStoragePath = `${course.id}/${ebookResource.id}/AI_Business_Essentials_Student_Textbook_v3.8.pdf`;
  assertResult(
    await client.storage
      .from("course-assets")
      .upload(ebookStoragePath, fs.readFileSync(ebookPath), {
        contentType: "application/pdf",
        upsert: true,
      }),
    "Upload AI Business Essentials student textbook",
  );
  let ebookResourceUrl = `storage:${ebookStoragePath}`;
  if (String(localEnvironment.VITE_DEMO_MVP_MODE).toLowerCase() === "true") {
    const signedResource = assertResult(
      await client.storage
        .from("course-assets")
        .createSignedUrl(ebookStoragePath, 60 * 60 * 24 * 7),
      "Create demo textbook link",
    );
    ebookResourceUrl = signedResource.signedUrl;
  }
  assertResult(
    await client
      .from("resources")
      .update({ url: ebookResourceUrl })
      .eq("id", ebookResource.id),
    "Link AI Business Essentials student textbook",
  );
  await client.storage
    .from("course-assets")
    .remove([
      "courses/ai-business-essentials/resources/AI_Business_Essentials_Student_Textbook_v3.8.pdf",
    ]);

  console.log(
    JSON.stringify(
      {
        courseId: course.id,
        cohortId: cohort.id,
        studentPath: `/student/courses/${cohort.id}/home`,
        modules: moduleRows.size,
        screens: content.modules.reduce(
          (total, module) => total + module.screens.length,
          0,
        ),
        assessments: assessmentRows.size,
        questions: content.assessments.reduce(
          (total, item) => total + item.questions.length,
          0,
        ),
        activities: activityRows.length,
        assignments: assignmentRows.size,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

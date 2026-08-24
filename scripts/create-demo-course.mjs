import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function readLocalEnvironment() {
  const values = {};
  const file = path.resolve(".env.local");
  if (!fs.existsSync(file)) return values;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) values[match[1].trim()] = match[2].trim();
  }
  return values;
}

const localEnvironment = readLocalEnvironment();
const required = (name) => {
  const value = process.env[name] || localEnvironment[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const supabaseUrl = required("VITE_SUPABASE_URL");
const anonKey = required("VITE_SUPABASE_ANON_KEY");
const adminEmail = required("DEMO_ADMIN_EMAIL");
const adminPassword = required("DEMO_ADMIN_PASSWORD");
const studentEmail = process.env.DEMO_STUDENT_EMAIL || "demo.student@synergybahamas.com";
const studentPassword = required("DEMO_STUDENT_PASSWORD");

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const admin = createClient(supabaseUrl, anonKey, clientOptions);
const studentAuth = createClient(supabaseUrl, anonKey, clientOptions);

function assertResult(result, context) {
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

async function findOne(table, match, columns = "*") {
  let query = admin.from(table).select(columns);
  for (const [column, value] of Object.entries(match)) query = query.eq(column, value);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Read ${table}: ${error.message}`);
  return data;
}

async function ensureRow(table, match, values) {
  const current = await findOne(table, match);
  if (current) {
    const data = assertResult(
      await admin.from(table).update(values).eq("id", current.id).select().single(),
      `Update ${table}`,
    );
    return data;
  }
  return assertResult(
    await admin.from(table).insert({ ...match, ...values }).select().single(),
    `Create ${table}`,
  );
}

function isoDaysFromNow(days, hour = 14) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
}

function dateDaysFromNow(days) {
  return isoDaysFromNow(days).slice(0, 10);
}

const blocksByLesson = {
  "A first look at AI in action": [
    {
      block_type: "text",
      content: {
        body: "Before the history and theory, take a few minutes to experience what a clear instruction can produce. The goal is to see how quickly a modern AI assistant can turn rough workplace text into something useful - and why a person still needs to review the result.",
      },
    },
    {
      block_type: "callout",
      content: {
        title: "Try it yourself: rewrite an email in three tones",
        body: "Use an AI assistant you are permitted to access. Compare professional and formal, friendly and warm, and concise and direct versions. Choose the one you would actually send and explain why it fits the situation.",
      },
    },
    {
      block_type: "prompt",
      content: {
        body: "ROLE: You are a careful workplace editor.\nOBJECTIVE: Rewrite the email three times: professional and formal; friendly and warm; concise and direct under 60 words.\nCONTEXT: Keep the meaning. Fix grammar. Replace anything unprofessional.\nORIGINAL: Hey - sorry I did not get back sooner. I have been very busy. The item you asked about is mostly finished, but there are a few loose ends. Can we meet this week? Let me know what works.",
      },
    },
    {
      block_type: "knowledge_check",
      content: {
        title: "Pause and reflect",
        body: "What made one rewrite more appropriate than the others?",
        answer: "A strong answer considers the audience, purpose, relationship, urgency, tone, and any organizational communication standards. The shortest or most polished option is not automatically the best one.",
      },
    },
  ],
  "What artificial intelligence is - and is not": [
    {
      block_type: "text",
      content: {
        body: "Artificial intelligence is the field of building computer systems that perform tasks which, when performed by humans, are described as intelligent. Examples include understanding language, recognizing images, making predictions, generating content, and making recommendations.\n\nAI is not magic, is not conscious, and does not understand the world in the same way a person does. Modern systems are powerful pattern finders, but they have no lived experience or independent responsibility for consequences.",
      },
    },
    {
      block_type: "heading",
      content: { text: "Five capabilities associated with intelligence" },
    },
    {
      block_type: "checklist",
      content: {
        body: "Learning - use new information\nProblem-solving - find a path to a goal\nReasoning - draw sound conclusions\nPerception - interpret raw input\nLanguage - understand and communicate",
      },
    },
    {
      block_type: "callout",
      content: {
        title: "AI performs tasks; it does not become accountable",
        body: "When a chatbot says 'I think,' it is producing language that fits the conversation. A person remains responsible for reviewing consequential outputs and deciding what happens next.",
      },
    },
    {
      block_type: "knowledge_check",
      content: {
        body: "How is an AI system different from ordinary software?",
        answer: "Ordinary software can follow fixed instructions. AI describes a broader family of systems that perform tasks associated with intelligence, often using learned patterns, probabilistic outputs, or generated content. The boundary is practical rather than magical.",
      },
    },
  ],
  "Human and machine intelligence": [
    {
      block_type: "text",
      content: {
        body: "Human and machine intelligence have different strengths. Humans connect information to lived experience, relationships, culture, ethics, and unstated context. Machines can process large volumes of data, detect patterns, and produce first drafts very quickly.",
      },
    },
    {
      block_type: "table",
      content: {
        body: "Capability | Humans | Machines today\nLearning | Few examples, lived experience, emotion, and feedback | Large datasets and repeated training; transfer can be brittle\nContext | Tone, history, body language, and unstated norms | Limited to supplied data and system context\nAdaptability | Moves across very different situations | Strongest on tasks similar to training and supplied context\nSpeed | Slower on routine work; strong situational judgment | Fast pattern matching, drafting, and calculation\nTrustworthiness | Can express uncertainty and take responsibility | May sound confident whether correct or incorrect",
      },
    },
    {
      block_type: "callout",
      content: {
        title: "Start with AI; finish with human review",
        body: "Drafting, summarizing, and pattern-finding can be good starting points. Tasks involving lived context, relationships, ethics, or consequential judgment remain human responsibilities.",
      },
    },
    {
      block_type: "heading",
      content: { text: "The Turing Test" },
    },
    {
      block_type: "text",
      content: {
        body: "Alan Turing proposed an operational test based on typed conversation: if a judge cannot reliably distinguish a hidden machine from a hidden person, the machine has passed for that interaction. The test rewards human-like mimicry, however, and does not prove understanding, truthfulness, or sound judgment.",
      },
    },
  ],
  "A brief history of AI": [
    {
      block_type: "text",
      content: {
        body: "AI did not arrive overnight. The field has moved through cycles of discovery, excitement, disappointment, and quiet progress. Today's conversational tools build on decades of earlier work in logic, statistics, machine learning, neural networks, and human-computer interaction.",
      },
    },
    {
      block_type: "list",
      content: {
        body: "1950 - Alan Turing introduces the imitation game\n1956 - The Dartmouth workshop helps name the field\n1970s - Limited computing and overpromising contribute to the first AI winter\n1980s - Expert systems bring rule-based AI into business\n1997 - Deep Blue defeats the world chess champion\n2012 - Deep learning accelerates progress in computer vision\n2022 - Generative AI reaches a broad public through conversational interfaces",
      },
    },
    {
      block_type: "callout",
      content: {
        title: "Useful but limited",
        body: "The durable stance is to treat AI as neither a miracle nor a fraud. Evaluate bounded capabilities, evidence, limitations, and the quality of the human review around each use case.",
      },
    },
    {
      block_type: "knowledge_check",
      content: {
        body: "What is an AI winter, and what causes one?",
        answer: "An AI winter is a period of reduced funding and public interest after expectations run ahead of what the technology can reliably deliver. Technical limitations, insufficient data or computing power, cost, and overpromising can all contribute.",
      },
    },
  ],
  "AI in daily work and responsible use": [
    {
      block_type: "text",
      content: {
        body: "AI is often invisible. It may rank, recommend, predict, classify, transcribe, translate, or detect patterns inside familiar products. Responsible use begins by identifying the task, the information involved, the possible impact, and the person who will review the result.",
      },
    },
    {
      block_type: "heading",
      content: { text: "Five questions before using AI" },
    },
    {
      block_type: "checklist",
      content: {
        body: "Bias - could this treat people unfairly?\nHallucination - which claims require evidence?\nPrivacy - is this information approved for the tool?\nWork - which tasks change, and who is affected?\nAccountability - who reviews, decides, and owns the outcome?",
      },
    },
    {
      block_type: "knowledge_check",
      content: {
        body: "A generated answer sounds confident. What should you do before using it in consequential work?",
        answer: "Check the important claims against reliable evidence, inspect what may be missing, confirm that the input and output comply with policy, and have a qualified person approve the final decision or communication.",
      },
    },
    {
      block_type: "assignment_reference",
      content: { title: "Complete: AI in my world" },
    },
    {
      block_type: "quiz_reference",
      content: { title: "Open the Module 1 self-check" },
    },
  ],
};

const lessonDefinitions = [
  ["A first look at AI in action", "Experience how a structured instruction changes a rough workplace draft.", 20],
  ["What artificial intelligence is - and is not", "Define AI in plain language and separate capability from consciousness.", 30],
  ["Human and machine intelligence", "Compare strengths, limitations, context, and the Turing Test.", 30],
  ["A brief history of AI", "Trace major milestones, hype cycles, and periods of quiet progress.", 30],
  ["AI in daily work and responsible use", "Recognize familiar AI and apply a five-question responsibility check.", 35],
];

async function main() {
  const login = await admin.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  const adminUser = assertResult(login, "Administrator sign-in").user;
  const roles = assertResult(await admin.rpc("get_user_roles"), "Read administrator roles");
  if (!roles.includes("administrator")) throw new Error("The supplied account is not an administrator.");

  const optionalMigrations = {};
  for (const [name, table] of [
    ["migration_012", "direct_messages"],
    ["migration_013", "access_offerings"],
  ]) {
    const result = await admin.from(table).select("id").limit(1);
    optionalMigrations[name] = !result.error;
  }

  let studentProfile = await findOne("profiles", { email: studentEmail });
  let studentSignupStatus = "existing";
  if (!studentProfile) {
    const signup = await studentAuth.auth.signUp({
      email: studentEmail,
      password: studentPassword,
      options: { data: { first_name: "Demo", last_name: "Student" } },
    });
    if (signup.error) throw new Error(`Create demo student: ${signup.error.message}`);
    studentSignupStatus = signup.data.session ? "ready" : "confirmation_required";
    for (let attempt = 0; attempt < 10 && !studentProfile; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      studentProfile = await findOne("profiles", { email: studentEmail });
    }
    if (!studentProfile) throw new Error("The demo auth user was created, but its profile trigger did not complete.");
  }

  const studentRole = await findOne("roles", { name: "student" });
  if (!studentRole) throw new Error("The student role is missing.");
  assertResult(
    await admin.from("user_roles").upsert(
      { user_id: studentProfile.id, role_id: studentRole.id },
      { onConflict: "user_id,role_id" },
    ),
    "Assign student role",
  );
  assertResult(
    await admin
      .from("profiles")
      .update({ first_name: "Demo", last_name: "Student", is_active: true })
      .eq("id", studentProfile.id),
    "Activate demo student",
  );

  const course = await ensureRow(
    "courses",
    { slug: "fundamentals-ai-business-professionals-demo" },
    {
      title: "Fundamentals of Artificial Intelligence for Business Professionals",
      short_description: "A practical introduction to confident, responsible AI use in the workplace.",
      description: "Designed for administrators, managers, analysts, educators, entrepreneurs, sales and service teams, project professionals, and other knowledge workers. No programming or advanced mathematics is required. This demo includes a complete Foundations of AI module with interactive lessons, a live session, self-check, homework, progress, attendance, and grade previews.",
      cover_image_url: "/demo/fundamentals-ai-business-cover.png",
      duration_weeks: 12,
      difficulty_level: "beginner",
      language: "en",
      is_published: true,
      is_self_paced: false,
      created_by: adminUser.id,
      metadata: {
        demo: true,
        source: "Fundamentals of Artificial Intelligence for Business Professionals editorial proof v1.6",
        course_hours: 24,
        module_count: 12,
        audience: "Business professionals and knowledge workers",
      },
    },
  );

  const categories = assertResult(
    await admin.from("course_categories").select("id,slug").in("slug", ["business-applications", "technology"]),
    "Read course categories",
  );
  for (const category of categories) {
    assertResult(
      await admin.from("course_categories_join").upsert(
        { course_id: course.id, category_id: category.id },
        { onConflict: "course_id,category_id" },
      ),
      "Attach course category",
    );
  }

  const cohort = await ensureRow(
    "cohorts",
    { course_id: course.id, slug: "demo-preview" },
    {
      name: "Demo Preview Cohort",
      description: "A sample learning space populated for product preview and acceptance testing.",
      start_date: dateDaysFromNow(-7),
      end_date: dateDaysFromNow(77),
      enrolment_open: false,
      max_students: 10,
      is_active: true,
      created_by: adminUser.id,
      metadata: { demo: true },
    },
  );
  assertResult(
    await admin.from("cohort_instructors").upsert(
      { cohort_id: cohort.id, instructor_id: adminUser.id, is_lead: true },
      { onConflict: "cohort_id,instructor_id" },
    ),
    "Assign demo instructor",
  );
  const enrolment = await ensureRow(
    "enrolments",
    { cohort_id: cohort.id, student_id: studentProfile.id },
    { status: "active", metadata: { demo: true } },
  );

  const module = await ensureRow(
    "modules",
    { course_id: course.id, title: "Module 1 of 12: Foundations of AI" },
    {
      description: "What AI is, where it came from, where it appears, and how to use it responsibly.",
      display_order: 1,
      is_published: true,
      metadata: {
        objectives: [
          "Define artificial intelligence in plain language",
          "Compare human and machine strengths",
          "Trace major milestones and AI winters",
          "Recognize everyday AI applications",
          "Identify bias, hallucination, privacy, work, and accountability concerns",
        ],
      },
    },
  );

  const lessons = [];
  for (let index = 0; index < lessonDefinitions.length; index += 1) {
    const [title, description, minutes] = lessonDefinitions[index];
    const lesson = await ensureRow(
      "lessons",
      { module_id: module.id, title },
      {
        description,
        display_order: index + 1,
        estimated_minutes: minutes,
        is_published: true,
        is_free_preview: index === 0,
        metadata: { demo: true },
      },
    );
    lessons.push(lesson);
    assertResult(await admin.from("lesson_blocks").delete().eq("lesson_id", lesson.id), "Refresh lesson blocks");
    const blocks = blocksByLesson[title].map((block, blockIndex) => ({
      ...block,
      lesson_id: lesson.id,
      display_order: blockIndex + 1,
    }));
    assertResult(await admin.from("lesson_blocks").insert(blocks), "Create lesson blocks");
  }

  assertResult(
    await admin.from("progress_records").upsert(
      {
        enrolment_id: enrolment.id,
        student_id: studentProfile.id,
        lesson_id: lessons[0].id,
        cohort_id: cohort.id,
        status: "completed",
        progress_percent: 100,
        time_spent_seconds: 900,
        last_accessed_at: isoDaysFromNow(-1),
        completed_at: isoDaysFromNow(-1),
      },
      { onConflict: "enrolment_id,lesson_id" },
    ),
    "Create completed lesson progress",
  );
  assertResult(
    await admin.from("progress_records").upsert(
      {
        enrolment_id: enrolment.id,
        student_id: studentProfile.id,
        lesson_id: lessons[1].id,
        cohort_id: cohort.id,
        status: "in_progress",
        progress_percent: 35,
        time_spent_seconds: 420,
        last_accessed_at: new Date().toISOString(),
      },
      { onConflict: "enrolment_id,lesson_id" },
    ),
    "Create active lesson progress",
  );

  const assignment = await ensureRow(
    "assignments",
    { cohort_id: cohort.id, title: "AI in my world" },
    {
      module_id: module.id,
      lesson_id: lessons[4].id,
      description: "Identify five places AI appears in your daily routine and describe one consequence if each system fails badly. Then ask an AI assistant for five concrete uses in your industry, verify the examples, and write about 150 words on the most useful and surprising ideas from this module.",
      assignment_type: "homework",
      max_points: 100,
      weight: 1,
      due_date: isoDaysFromNow(7, 23),
      allow_late_submission: true,
      allow_file_upload: true,
      allowed_file_types: ["pdf", "docx", "txt"],
      max_file_size_mb: 10,
      min_words: 150,
      max_words: 750,
      is_published: true,
      created_by: adminUser.id,
    },
  );

  const assessment = await ensureRow(
    "assessments",
    { cohort_id: cohort.id, title: "Module 1 self-check" },
    {
      module_id: module.id,
      lesson_id: lessons[4].id,
      description: "Check your understanding of AI foundations, history, limitations, and responsible use.",
      assessment_type: "quiz",
      instructions: "Choose the best answer for each question. You may review the lessons before your second attempt.",
      time_limit_minutes: 15,
      max_attempts: 2,
      passing_score: 70,
      is_published: true,
      shuffle_questions: false,
      show_results_immediately: true,
      created_by: adminUser.id,
    },
  );
  assertResult(await admin.from("assessment_questions").delete().eq("assessment_id", assessment.id), "Refresh quiz questions");
  const quizQuestions = [
    ["Who coined the term artificial intelligence, and when?", ["Alan Turing, 1950", "John McCarthy, 1956", "Marvin Minsky, 1965", "Geoffrey Hinton, 1986"], "John McCarthy, 1956", "The field was named at the 1956 Dartmouth workshop, associated with John McCarthy."],
    ["Which is not one of the five intelligence capabilities discussed?", ["Learning", "Reasoning", "Memorization speed", "Perception"], "Memorization speed", "The five capabilities are learning, problem-solving, reasoning, perception, and language."],
    ["What is an AI winter?", ["A weather-related failure", "A planned research pause", "Reduced funding and enthusiasm after expectations outrun reality", "A temporary ethics regulation"], "Reduced funding and enthusiasm after expectations outrun reality", "AI winters follow periods when claims and expectations exceed dependable capability."],
    ["Which capability are humans generally stronger at?", ["Recalling exact text at scale", "Reading body language and unstated context", "Performing arithmetic at scale", "Translating many languages instantly"], "Reading body language and unstated context", "Human judgment integrates lived experience, relationships, culture, and unstated context."],
    ["Which is a familiar example of AI?", ["Pocket calculator", "Spam filter", "Printed dictionary", "Standard light switch"], "Spam filter", "Spam filters learn patterns and classify messages."],
    ["A confident but factually wrong generated answer is called what?", ["Bias error", "Hallucination", "Hardware fault", "System prompt"], "Hallucination", "Hallucination is confident-sounding but factually incorrect generated content."],
    ["What stance does this module recommend?", ["AI is a miracle", "AI is a fraud", "AI is useful but limited and requires human judgment", "AI should be banned"], "AI is useful but limited and requires human judgment", "Responsible use combines bounded AI capability with evidence, policy, and human accountability."],
  ];
  assertResult(
    await admin.from("assessment_questions").insert(
      quizQuestions.map(([question_text, options, correct_answer, explanation], index) => ({
        assessment_id: assessment.id,
        question_type: "multiple_choice",
        question_text,
        options,
        correct_answer,
        explanation,
        points: 1,
        display_order: index + 1,
      })),
    ),
    "Create quiz questions",
  );

  const previousSession = await ensureRow(
    "live_sessions",
    { cohort_id: cohort.id, title: "Welcome and AI in action" },
    {
      description: "A short orientation and guided workplace email demonstration.",
      session_type: "workshop",
      scheduled_start: isoDaysFromNow(-3, 14),
      scheduled_end: isoDaysFromNow(-3, 15),
      instructor_id: adminUser.id,
      meeting_platform: "custom",
      preparation_notes: "Review the first lesson and bring one low-risk workplace writing task.",
      is_cancelled: false,
      created_by: adminUser.id,
      metadata: { demo: true },
    },
  );
  const upcomingSession = await ensureRow(
    "live_sessions",
    { cohort_id: cohort.id, title: "Module 1 live recap and ethics clinic" },
    {
      description: "Review AI foundations, classify real workplace use cases, and apply the five-question responsibility check.",
      session_type: "workshop",
      scheduled_start: isoDaysFromNow(3, 14),
      scheduled_end: isoDaysFromNow(3, 15),
      instructor_id: adminUser.id,
      meeting_platform: "custom",
      preparation_notes: "Complete the five lessons and bring one use case for discussion.",
      is_cancelled: false,
      created_by: adminUser.id,
      metadata: { demo: true },
    },
  );
  for (const session of [previousSession, upcomingSession]) {
    const existingLink = await findOne("live_session_modules", {
      live_session_id: session.id,
      module_id: module.id,
    });
    if (!existingLink)
      assertResult(
        await admin.from("live_session_modules").insert({
          live_session_id: session.id,
          module_id: module.id,
        }),
        "Connect live session to module",
      );
  }
  assertResult(
    await admin.from("attendance_records").upsert(
      {
        live_session_id: previousSession.id,
        student_id: studentProfile.id,
        enrolment_id: enrolment.id,
        status: "present",
        arrived_at: isoDaysFromNow(-3, 14),
        left_at: isoDaysFromNow(-3, 15),
        notes: "Demo attendance record",
        recorded_by: adminUser.id,
      },
      { onConflict: "live_session_id,student_id" },
    ),
    "Create attendance preview",
  );

  const gradeCategory = await ensureRow(
    "grade_categories",
    { cohort_id: cohort.id, name: "Module practice" },
    { description: "Knowledge checks and applied practice", weight: 100, drop_lowest: 0, display_order: 1 },
  );
  const gradeItem = await ensureRow(
    "grade_items",
    { grade_category_id: gradeCategory.id, name: "Orientation knowledge check" },
    { description: "A sample result included to demonstrate the learner gradebook.", max_points: 10, display_order: 1 },
  );
  assertResult(
    await admin.from("grades").upsert(
      {
        grade_item_id: gradeItem.id,
        enrolment_id: enrolment.id,
        student_id: studentProfile.id,
        score: 9,
        max_score: 10,
        percentage: 90,
        letter_grade: "A",
        feedback: "Strong start. Continue connecting responsible-use checks to specific workplace tasks.",
        graded_by: adminUser.id,
        graded_at: new Date().toISOString(),
      },
      { onConflict: "grade_item_id,enrolment_id" },
    ),
    "Create grade preview",
  );

  await ensureRow(
    "announcements",
    { cohort_id: cohort.id, title: "Welcome to the demo learning space" },
    {
      body: "Start with the first lesson, try the workplace email prompt, and explore the curriculum, live sessions, assignments, and performance pages. This sample cohort is intentionally preloaded with partial progress so you can see the complete learner experience.",
      is_pinned: true,
      is_published: true,
      author_id: adminUser.id,
      published_at: new Date().toISOString(),
    },
  );
  await ensureRow(
    "discussions",
    { cohort_id: cohort.id, title: "Where do you already encounter AI?" },
    {
      module_id: module.id,
      lesson_id: lessons[4].id,
      body: "Share one visible AI feature and one example of background intelligence from your daily work or routine. What could go wrong if either failed badly?",
      is_pinned: true,
      is_locked: false,
      author_id: adminUser.id,
      is_question: true,
      is_resolved: false,
    },
  );
  let welcomeNotificationCreated = true;
  try {
    await ensureRow(
      "notifications",
      { user_id: studentProfile.id, title: "Your demo course is ready" },
      {
        type: "course",
        body: "Explore Module 1: Foundations of AI and the preloaded learner progress example.",
        link_url: `/student/courses/${cohort.id}/home`,
        related_id: cohort.id,
        is_read: false,
      },
    );
  } catch (error) {
    welcomeNotificationCreated = false;
    console.warn(`Optional welcome notification skipped: ${error.message}`);
  }

  await studentAuth.auth.signOut();
  const studentLogin = await studentAuth.auth.signInWithPassword({
    email: studentEmail,
    password: studentPassword,
  });
  const studentLoginReady = !studentLogin.error;
  let studentVerification = null;
  if (studentLoginReady) {
    const verificationResults = await Promise.all([
      studentAuth.from("enrolments").select("id").eq("id", enrolment.id).single(),
      studentAuth.from("lessons").select("id,module:modules!inner(course_id)").eq("module.course_id", course.id).eq("is_published", true),
      studentAuth.from("assignments").select("id").eq("cohort_id", cohort.id).eq("is_published", true),
      studentAuth.from("assessments").select("id").eq("cohort_id", cohort.id).eq("is_published", true),
      studentAuth.from("live_sessions").select("id").eq("cohort_id", cohort.id),
      studentAuth.from("progress_records").select("id").eq("cohort_id", cohort.id).eq("student_id", studentProfile.id),
      studentAuth.from("grades").select("id").eq("student_id", studentProfile.id),
      studentAuth.from("announcements").select("id").eq("cohort_id", cohort.id).eq("is_published", true),
      studentAuth.from("discussions").select("id").eq("cohort_id", cohort.id),
    ]);
    const verificationError = verificationResults.find((result) => result.error)?.error;
    if (verificationError) throw new Error(`Student visibility check: ${verificationError.message}`);
    studentVerification = {
      enrolmentVisible: Boolean(verificationResults[0].data),
      lessonsVisible: verificationResults[1].data.length,
      assignmentsVisible: verificationResults[2].data.length,
      assessmentsVisible: verificationResults[3].data.length,
      liveSessionsVisible: verificationResults[4].data.length,
      progressRecordsVisible: verificationResults[5].data.length,
      gradesVisible: verificationResults[6].data.length,
      announcementsVisible: verificationResults[7].data.length,
      discussionsVisible: verificationResults[8].data.length,
    };
  }

  console.log(
    JSON.stringify(
      {
        courseId: course.id,
        cohortId: cohort.id,
        studentId: studentProfile.id,
        studentEmail,
        studentSignupStatus,
        studentLoginReady,
        lessons: lessons.length,
        assignment: assignment.title,
        assessment: assessment.title,
        welcomeNotificationCreated,
        optionalMigrations,
        studentVerification,
        studentPath: `/student/courses/${cohort.id}/home`,
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

# Synergy Academy

Synergy Academy is Synergy Bahamas’ role-aware eLearning platform for flexible and instructor-led cohorts. It combines reusable lesson content, live delivery, assignment submission, grading, attendance, communication, progress, completion records, organization contacts, and capped seats in one Vite/React application backed by Bolt Supabase.

## Local development

Requirements: Node.js 20 or newer and access to the Bolt Supabase project.

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Create `.env.local` with the Bolt project’s public client values:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

The file is ignored by Git. Never commit the service-role key to this frontend.

In Supabase Authentication URL settings, allow both `http://127.0.0.1:5174/reset-password` and `https://academy.synergybahamas.com/reset-password` so password-reset links return to the correct environment.

## Verification

```bash
npm run typecheck
npm run lint
npm run verify:migrations
npm run verify:course
npm run build
```

The app is designed for local verification before the user manually syncs GitHub and publishes through Bolt. The production URL is `https://academy.synergybahamas.com`.

Published course information is available through `/courses` and `/courses/:slug` after migration 013. These routes intentionally provide account/sign-in calls to action without checkout or public self-enrolment.

## Database and storage

Apply the SQL files in `supabase/migrations` in timestamp order. Migration `012_beta_readiness.sql` is required before file submissions, safe student quiz attempts, private messages, assignment attempt history, or auditable grade overrides are enabled. Migration `013_access_entitlements.sql` adds direct live-recording uploads, organization contacts, dated course/platform contracts, and capped seats. Migration `017_practice_checks_do_not_affect_grades.sql` keeps required module checks out of the official weighted grade and allows unlimited practice attempts. Migration `018_live_assessment_feedback.sql` enables per-question feedback without exposing answer keys. Migration `019_student_course_asset_access.sql` enables enrolled students to open private course resources. Migration `020_profile_avatars.sql` enables owner-managed profile photos. Migration `021_student_lesson_notes.sql` stores private notes for each learning screen. Migration `022_resource_drip_release.sql` lets administrators and assigned instructors stage course resources for immediate, scheduled, or completion-based release while keeping unreleased private files protected.

The frontend uses only the anon key. Row-level security remains the authorization boundary for profiles, multi-role assignments, cohorts, academic records, communications, and files.

## Account and role workflow

1. A person creates an account from `/signup`.
2. An administrator opens **Users & roles** and assigns one or more roles.
3. Instructors are assigned to a cohort from **Cohorts**.
4. Students are enrolled from **Enrolments**.
5. Multi-role users switch workspaces from the user menu; they do not select a role at sign-in.
6. Organization contacts manage capped employee seats from **Company seats** without receiving platform-administrator access.

## AI Business Essentials course package

The checked-in B1-101 package contains the complete approved learner experience:

- Introduction plus Modules 1–12, with 286 one-topic eLearning screens
- Twelve unlimited-attempt 10-question module checks, two graded quizzes, a 30-question midterm, and a 48-question final exam. Each graded checkpoint and exam allows one attempt.
- Thirteen guided activities with completion self-checks
- Four homework assignments and a staged capstone workspace with final submission and presentation guidance

To refresh the generated package from the approved storyboard sources, run `npm run content:build` with the document-production Python runtime available. To install or update it in the configured Supabase project, add the following local-only administrator credentials and run `npm run seed:course`:

```dotenv
ACADEMY_ADMIN_EMAIL=YOUR_ADMIN_EMAIL
ACADEMY_ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD
```

After applying migrations 017-021, the seed updates the existing AI course when present, preserves the course and cohort model, publishes the complete package, and maps the official 10% / 40% / 20% / 30% grade categories. In local demo mode, the seed creates a seven-day signed textbook link so the resource can be reviewed before migration 019 is applied. Never commit administrator credentials.

## Course operating sequence

1. Create a course and keep it in draft while authoring.
2. Add modules, lessons, and content blocks in **Curriculum builder**. Blocks can start a new lesson part or join an existing part, allowing text and uploaded image/video content to share one stacked or split learning view.
3. Publish the required modules and lessons, then publish the course.
4. Create a cohort and assign its lead instructor.
5. Assign student roles and enrol the learners.
6. Schedule live sessions, create assignments, and publish announcements.
7. Students complete lessons, join sessions, submit work, and participate in discussions.
8. Instructors take attendance and grade submitted assignments.
9. An administrator evaluates an enrolment against the course’s lesson, assignment, quiz, grade, and attendance requirements. Eligible learners are completed and receive a printable certificate automatically.

AI Business Essentials is the first complete course package. The catalog, enrolment, course shell, and database remain course-agnostic so additional courses can be added without changing the student navigation model.

See [`docs/PLAN_ALIGNMENT.md`](docs/PLAN_ALIGNMENT.md) for the feature-by-feature beta readiness review and pre-launch checklist.

See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for course setup, cohort delivery, completion, and manual role/security acceptance steps.

See [`docs/ACCESS_MODEL.md`](docs/ACCESS_MODEL.md) for cohort, individual, organization, term, seat, and future-commerce boundaries.

## Repository privacy

`Prompts/` is internal-only and ignored by Git. Do not remove that rule or copy prompt material into public source files.

[Open the project in Bolt](https://bolt.new/~/sb1-i6fn1wp4)

# LMS implementation and Bolt.new handoff

This implements the approved review packages in the existing Vite/React academy. No Figma rebuild, replacement database, or production migration was performed. The earlier review document is a historical baseline, not the current release status.

## Included

- One shared, cached learning-path model and accordion outline for Learn it, Do it, Assess it. Optional activities/checks, multiple lessons, release gates and non-consecutive module orders are supported. Dashboard/course cards use the same whole-path percentage.
- Consistent player width, lighter headers, mobile outline dialog, reduced-motion support, keyboard-focused notes and device resume position. Notes have account storage after migration 021 and an explicit device-only fallback when unavailable.
- Graded assessments reserve one server-owned attempt. Reloads resume it without restarting the timer. Checked answers are immutable and grading uses server-saved answers. Repeated final submission is idempotent. Students can review completed assessments repeatedly.
- An assigned instructor or administrator can grant one additional attempt to a specific enrolled student and assessment, with a recorded reason and actor. This does not delete prior scores. Existing gradebook behavior retains the best score after an authorized retake.
- Practice checks are repeatable and do not affect the official grade. Twelve matching questions have keyboard/touch alternatives. The 228-question bank now has 228 distinct prompts, with separate graded scenarios and explanatory feedback; answer keys are not imported into the student application.
- 13 learning modules, including Introduction; 298 screens; 12 practice packets with fictional input, worked examples and downloadable templates; 12 activities and 8 assignments. Introduction has no activity/check after migration 024. Module 12 remains review/reference.
- Activity and assignment drafts finalize only after evidence uploads succeed. Persisted evidence can be reopened. Submitted/graded work is protected; instructors can return submitted work for revision. Drafts no longer consume submission attempts. Device text drafts help survive navigation; files must still upload before submission.
- Shared rubric criteria with stable IDs, point values, levels and version in assignment configuration. Staff save criterion scores and feedback. Activity feedback is excluded from the official grade; no automatic AI grade release is implemented.
- Q&A conversations/replies in student Messages and staff Communications; editable discussion posts, reporting and reversible staff hiding; existing emoji/reply controls remain.
- Resource editing, scheduled/checkpoint release controls, fresh private download links on click, upcoming/past meeting grouping, missing-link messages and delivery-readiness warnings.
- Safer bootstrap script: it refuses to overwrite an existing course. Use the versioned migration for curriculum updates, not a destructive reseed.

## Apply in Bolt.new

1. Sync the GitHub `main` branch into the existing Bolt project. Preserve its Supabase connection and environment variables.
2. Back up the target database and inspect applied migration history. Apply only missing migrations, in order:

   | Migration | Purpose |
   | --- | --- |
   | `20260904224500_021_student_lesson_notes.sql` | Account-synced study notes |
   | `20260904231500_022_resource_drip_release.sql` | Resource release rules and storage access |
   | `20260905000100_023_assessment_sessions.sql` | Server sessions and instructor-authorized extra attempts |
   | `20260905000200_024_curriculum_revision.sql` | Updated B1-101 content, rubrics and snapshots of historical questions |
   | `20260905000300_025_submission_and_review_integrity.sql` | Draft/grade protection and historical assessment review |
   | `20260905000400_026_discussion_moderation.sql` | Reporting and reversible discussion moderation |

3. These depend on the existing academy migrations through 020. **Do not blindly replay all historical files:** the repository contains an old duplicate 012 filename. Migration 013 also has a small fresh-install SQL correction (an invalid composite `INTO` target); do not rerun its whole schema on an already initialized database.
4. Apply 023–026 together during a quiet period, before inviting students into new sessions. Migration 024 deliberately stops if B1-101 has open new-format sessions or unexpected custom question counts. It updates the existing seeded course by stable content keys, preserves student work/grades/IDs and snapshots old question text for historical review. If it stops, investigate the reported condition; do not delete attempts or force a reseed.
5. Restart/refresh the app. Confirm the Introduction outline now contains only its learning step, module 1 has 35 screens and the course has 37 Learn/Do/Assess steps.

Suggested Bolt instruction:

> Pull the latest main branch without replacing the project or database. Inspect Supabase migration history, then apply only unapplied migrations 021 through 026 in their documented order. Do not run seed:course against the existing academy. Preserve enrolments, submissions, attempts and grades. Run the release checks and the student/instructor smoke tests below, and report any error without bypassing a safeguard.

## Verification completed locally

- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run verify:course`: 13 modules, 298 screens, 12 checks, 228 distinct authored questions, 12 activities, 8 assignments.
- `npm run verify:path`: optional workflow combinations, multiple lessons, module-order gaps, draft/pass/release gates, percentage and next-step selection.
- `npm run verify:sessions`: isolated PostgreSQL execution of migrations with synthetic course/student data. Tests cover curriculum replacement and historical snapshots; begin/resume; immutable answers; authoritative/idempotent grading; one-attempt cap; staff grants and unauthorized grant rejection; timeout; repeated practice/matching; draft counts; returned work; history; protected rubric scores; direct-write RLS; timed resource access; safe upcoming metadata; reporting and staff-only hiding.
- PostgreSQL tests use PGlite with auth/storage stubs. Extension-only migration 016 is excluded from that runtime; static migration validation covers it. This is not a complete hosted Supabase, storage-upload, or multi-connection race test.
- Browser checks in the in-app local preview: desktop learning/Next, reading-position restoration after reload, Notes initial focus and Escape focus restoration, mobile activity layout/no horizontal overflow, mobile outline, and course navigation. No real graded attempt, grade change, report, reply, upload or student submission was used for testing.

## Still requires hosted verification / staff input

- Run the migrations in Bolt before testing account-synced notes, actual uploads, new-format assessment UI, instructor-only permissions, resource checkpoint combinations, moderation and authorized retries on the connected database. The local preview still reads older live course rows until 024 is applied; this is not a failed content export.
- Smoke-test with a dedicated test student: Introduction → Learn → save/reload an activity draft → upload evidence → submit → check → next module. Repeat a practice check. In a test-only graded assessment, verify a reload resumes the timer, a second attempt is blocked, the assigned instructor can authorize one extra, and review does not consume an attempt.
- Use an instructor-only account to test Q&A replies, rubric feedback, return-for-changes, resource editing and moderation. Verify another cohort cannot read or change those records.
- Supply real cohort dates and Zoom links, reconcile assignment due dates with the cohort end date, and upload the chosen slides/class files. No schedule or joining URL was invented.
- The capstone's final evidence is described as required, feedback-only work; its presentation contributes 20%. Certificate enforcement is not being enabled while certificates remain “Coming Soon.” Confirm final completion requirements before activating certificates.
- Existing historical test discussion posts were not automatically deleted. Teaching staff can now hide them reversibly after reviewing the records.
- Dependency installation reported 11 audit findings (3 low, 5 moderate, 3 high). A separate dependency security/upgrade pass remains advisable before production launch; no forced major-version upgrades were made.
- This is not a formal WCAG, sixth-grade readability, exhaustive ebook-fidelity or production-load certification. The premium styling guidance informed spacing, hierarchy, dialogs and the shared learning experience; the content remains subject to instructional review.

Local preview: `http://127.0.0.1:5174/student`. Revised authored content can also be inspected before database deployment at the development-only `/dev/ai-business-essentials` preview; it is not a substitute for the connected student workflow.

# Synergy Academy — UI, UX and content review

Reviewed 4 September 2026 against the local app on port 5174 and its connected Supabase database. Starting commit: `b64f3b2`. This is a review and small cosmetic pass, not a production release or approval to change grading, curriculum or database rules.

## Verdict

The academy has a strong visual foundation: restrained blue branding, clear course sections, a welcoming dashboard, and a promising Learn it → Do it → Assess it structure. The next investment should be consistency, reliable saving and assessment quality—not another broad visual redesign.

I would not yet call it ready for a graded cohort launch. The most important issues are missing database support for features already shown in the UI, reusable exam answers, inconsistent completion rules, and incomplete activity submission safeguards.

## Minor improvements completed

- Removed the unused side column from welcome screens that have no side note. Outcomes now use the available width.
- Reduced the numbered learning player height to account for the workflow bar, keeping Next visible at the tested 1287 × 912 desktop viewport.
- Aligned assessment card actions along the bottom of each row.
- Added accessible names to activity work, reflection and evidence fields, plus a visible keyboard-focus style for checklist rows.
- Exposed the selected Messages section to assistive technology.
- Removed certificate subtitle wording that promised downloads while the page says “Digital Certificates Coming Soon.”

No curriculum, scores, attempt limits, enrolments, resource rules or database schema were changed. No student work was submitted. Nothing was committed or pushed.

### Verified learning layout after the small fixes

![Learning screen after cosmetic improvements](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/22-learning-after.png)

### Verified assessment card alignment

![Assessment cards after alignment](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/23-assessments-after.png)

## Major work proposed for approval

| Package | Priority | Recommended changes | Acceptance criteria |
| --- | --- | --- | --- |
| A. Reliability and release readiness | Before launch | Reconcile and apply the notes/resource-release migrations; test access rules; use renewable private resource links; make submission finalization safe; add an admin readiness check. | Notes survive another-device login; locked resources cannot be fetched early; failed uploads do not mark activities complete; readiness reports real missing setup. |
| B. Assessment quality and integrity | Before graded launch | Author meaningful practice questions and a separate graded bank; establish server-owned attempts and resume behavior; enforce the one-attempt rule atomically. | Questions cover outcomes across each module; graded items are not verbatim practice items; parallel/restarted sessions cannot bypass the approved attempt policy. |
| C. One guided learning experience | High | Share one player, outline, notes control and progress model across Learn/Do/Assess; restore mobile access to the outline; resume the last screen; make the next unfinished step obvious. | A course with Learn only, Learn + Do, Learn + Assess, or all three works without special naming rules; progress matches on every page. |
| D. Content and assessment alignment | High | Update navigation instructions, add worked examples and practice files, clarify weighted versus feedback-only assignments, and introduce standardized rubrics. | Every instruction matches the actual UI; every activity has the inputs needed to complete it; students and instructors see the same success criteria. |
| E. Communication, scheduling and scale | Medium | Show Q&A conversations and instructor replies; update session dates and links; improve multi-course/cohort labels, instructor profiles and reusable course setup. | Students can ask and receive help in their registered cohort; dates agree; staff can identify students and edit existing release rules safely. |

Suggested order: A → B, then C and D together, followed by E. These packages are recommendations only and await approval.

## Findings and supporting evidence

### 1. Features shown in the UI are not fully available in the connected database

Live, read-only checks returned:

- `public.lesson_notes` could not be found in the schema cache.
- `resources.release_mode` does not exist.
- `get_upcoming_course_resources(cohort_uuid)` could not be found.

The Notes dialog reports “Saved on this device.” That is a useful fallback, but it is not account-synced storage and can be lost with browser/device changes. Resource authoring offers release controls, although the required database objects are unavailable. Do not present this as a fully operational drip-release feature yet.

The repository contains migrations 021 and 022 for these features. First reconcile the target database's applied migration history, then apply and integration-test the intended migrations and row-level access rules. Static migration validation passing does not prove deployment.

Evidence: captures 4 and 20; `tmp/lms-audit-2026-09-04/runtime-audit.mjs`; `supabase/migrations/20260904224500_021_student_lesson_notes.sql`; `supabase/migrations/20260904231500_022_resource_drip_release.sql`.

### 2. The assessment bank measures sentence recognition more than applied skill

A full structural scan of the bundled question data found:

| Check | Result |
| --- | --- |
| Question instances across practice and graded assessments | 228 |
| Unique question prompts | 120 |
| Prompts beginning “Which statement best explains…” | 228 of 228 |
| Explanations identical to the correct answer | 228 of 228 |
| Graded question instances reused verbatim from practice | 108 of 108 |
| Answers absent from the listed options | 0 |

The generator selects early lesson screens and uses their lead sentences as answers. Distractors are often other true lesson statements. Later topics can therefore be missed, and students can memorize the practice bank before a graded exam.

Replace this with an outcome-to-question map. Use short workplace scenarios, error spotting, matching capabilities to tasks, sequencing a safe workflow and evaluating an output. Matching/ordering should have a keyboard and tap alternative to dragging. Provide a short explanation of why an answer works and why a tempting alternative does not. Keep practice feedback immediate; agree separately on graded-exam feedback timing before changing the user's existing policy.

Evidence: `src/content/ai-business-essentials.json`; `scripts/export-ai-business-content.py:113` and `:133`; `tmp/lms-audit-2026-09-04/content-audit.mjs`.

### 3. A configured one-attempt limit is not yet a robust exam session

The database correctly has one attempt configured for each of the four graded assessments and effectively unlimited practice checks. However, code inspection shows answer keys bundled into the client, a local-answer fallback, and attempts recorded on final submission rather than when an exam begins. The submission function checks the existing count before inserting, without an evident concurrency lock. Displayed durations are not a complete server-enforced timed session.

These are integrity risks identified in source, not exploits performed during this review. Introduce a server-owned started attempt, resumable answers, atomic attempt allocation and authoritative grading. Keep practice review unlimited. Agree what should happen after disconnects, accidental navigation and time expiry; do not consume a student's sole attempt unfairly.

Evidence: `src/pages/student/course/CourseAssessments.tsx:26`, `:299`, `:973`; migrations 017 and 018. Capture 5 shows the correct visible one-attempt configuration. Graded attempt execution was not tested because the demo learner is locked out by prerequisites.

### 4. Course progress means different things on different pages

The same learner sees 15% on Dashboard/Home (2 of 13 learning lessons) but 5% in Learning (2 of 38 workflow steps). Module 1 is visually completed while its activity is unfinished and its check score is 20%. These values can each be internally consistent, but the labels make them look contradictory.

Choose one primary course-progress definition. If useful, expose reading progress and whole-path progress as separate, clearly named metrics. A module should distinguish reading complete, activity submitted and knowledge check passed. Use one shared calculation and status vocabulary, including optional steps and multiple lessons per module. Continue should open the next unfinished step and restore the last reading position.

Evidence: captures 1, 2, 10 and 11; `LessonPage.tsx:107` resets the active screen on lesson changes.

### 5. Learn, Do and Assess still feel like separate page implementations

The reading page is narrower and has Notes/outline controls; the activity page changes width and controls. Mobile activity hides the outline without an equivalent opener. The workflow strip communicates phases but is not an interactive step navigator. Nested scrolling competes with the page scroll.

Keep the current brand and accordion concept. Build one responsive learning shell with one header, shared tools, consistent footer actions, a module drawer on small screens and a single intentional content-scroll area. Do not shrink text to force all content onto a phone screen. Remove duplicate module titles and use the space for the current topic and next action.

Evidence: captures 2, 3, 15 and 16. The small desktop sizing improvement does not resolve the mobile/shared-shell issue.

![Mobile activity: outline access and nested scrolling need improvement](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/15-mobile-activity.png)

### 6. Activity submission needs stronger work and evidence safeguards

The workspace has a good starting structure: directions, work, reflection, evidence and a shared checklist. But the submit condition checks the checklist, not whether required work/evidence exists. The submission is marked submitted before files finish uploading; an upload failure can leave the activity submitted. Save draft can also overwrite the status of an existing submission. The workspace does not clearly show persisted evidence files after returning.

Define required fields per activity; show saved versus unsaved state and uploaded evidence; upload first and finalize only after success; preserve submission/feedback history. Make draft saving distinct from withdrawing or replacing a submission. Add retryable uploads and an unsaved-changes warning.

For standardized grading, give each rubric criterion a stable ID, points, performance levels and evidence references. Save rubric version and criterion scores. This creates a sound basis for future algorithm/AI assistance, with instructor review before grades are released. Do not make an AI-generated grade authoritative by default.

Evidence: capture 3; `src/pages/student/course/CourseActivities.tsx:98`–104; structured activity payload and gradebook review.

### 7. Course directions need a synchronization pass

- Introduction still describes the old four-area layout and an Activities destination that no longer exists.
- The twelve numbered module endings announce that the check is available and say “Go to assessment,” while the actual flow requires the activity first.
- Introductory wording can imply three graded quizzes plus a separate midterm; the configured structure is three quiz-category checkpoints, including the midterm, plus the final exam.
- References to “attached course requirements” should be replaced with self-contained course instructions.
- Some completion and exam-unlock descriptions do not match the implemented prerequisite checks.

Update the source data and its generation pipeline together. Keep Introduction separate from the numbered modules and retain Module 12 as review/reference, not a capstone lesson. Avoid replacing clear student language with implementation terms.

Evidence: full structured scan, manual review of Introduction and all module endings, captures 5 and 10.

### 8. Resources, schedule and grading need stronger context

Only the textbook is currently listed as a student resource. Its link returns a PDF successfully, but it is a stored signed URL; it should use a durable private storage reference and generate fresh authorized links when opened. Populate slides, safe practice files, templates and reference sheets, with approved release rules.

Live Meetings contains two past August sessions, missing join links, and an old “five lessons” instruction. The cohort end date and later assignment dates should be reconciled. Show upcoming/past grouping, timezone and an honest “Link not posted yet” state. Do not invent meeting dates or Zoom links.

The grading weights match the supplied plan: homework 10%, quizzes 40%, presentation 20%, final exam 30%. Explain that the midterm belongs to the quiz category. The capstone's displayed points and its grade contribution need a clear distinction: the source gives the final capstone submission zero weight while the presentation carries 20%. Confirm whether the submission is a separate completion requirement.

Evidence: captures 6, 8, 9 and 21; read-only textbook HEAD request; assignment source data. No grades or dates changed.

### 9. Communication and staff tools need a completion pass

Announcements is correctly first/default. Course Q&A is scoped to the learner's active enrolments, but the student page loads and displays top-level questions without a thread/reply view. Students need to see the instructor's answer and reply in context. Include cohort as well as course when a student has more than one registration.

Discussion posts already have replies and emoji controls. Add editing/moderation/reporting as a separately approved enhancement, not a reason to rebuild it. Existing test posts and “Unnamed user” labels reduce credibility; clean demo data only after selecting records for approval.

Course Studio marks readiness from structural checks, not actual delivery quality or database availability. Add checks for release prerequisites, valid resources, scheduling conflicts, complete rubrics and assessment coverage. The gradebook has several identical “Demo Student” options; include an email or safe identifier to reduce wrong-student grading risk. Existing resources also need an Edit action, including release-rule editing.

Evidence: captures 7, 12, 19–21; `StudentMessages.tsx:100` and `:357`.

### 10. Accessibility and visual consistency

The blue theme, card grouping and semantic icons are useful. Avoid another layer of decorative tiles: standardize content widths, spacing and status colors instead. Pair color with labels/icons. The module catalog's oversized Introduction card and dashboard course tile push key actions down; use a compact introduction row and scalable course cards. The profile summary's long email can overflow its column.

Opening Study notes leaves keyboard focus on the background Notes button (confirmed with the active DOM element), rather than inside the dialog. Add initial focus, containment, Escape dismissal and focus restoration as a tested shared-dialog behavior. Mobile navigation needs an obvious overflow affordance. Verify text contrast, disabled-state readability, focus visibility, 200% zoom, reduced motion and screen-reader announcements in a dedicated accessibility pass.

Small field-label and focus-style fixes were included, but this is not a WCAG compliance certification. Contrast was not measured systematically and a complete assistive-technology audit was not performed.

## Content review by module

The source contains 13 modules, 286 explainer screens, 13 activities and 8 assignments. The median screen has approximately 66 words and the longest 125 under the audit's text-field count. This supports digestibility, but short text alone does not establish a sixth-grade reading level or sufficient teaching depth. Manual review sampled welcome, middle and ending screens in every module and inspected activity instructions; it did not render all 286 screens or compare every sentence with the original ebook.

| Module | Screens | Recommended instructional improvement |
| --- | ---: | --- |
| Introduction | 16 | Explain the current navigation and next action; clarify grading/checkpoints; remove obsolete directions. |
| 1. AI Basics and Safe First Steps | 34 | Break the outline into small topic groups; add a worked capability-sort example; align activity directions with every checklist requirement. |
| 2. Prompting, Revision, and Checking Output | 23 | Keep the CIDI example; add a fillable prompt template and an annotated weak/strong output pair. |
| 3. Choosing AI Tools and Models | 20 | Supply a worked tool-selection scorecard; distinguish privacy/cost/quality; offer a no-paid-tool alternative. |
| 4. AI for Everyday Work | 19 | Supply fictional source notes and a corrected summary so students can practice and compare. |
| 5. Workplace Communication | 20 | Show the same facts written for two audiences; demonstrate the review lenses in plain language. |
| 6. Multimodal and Digital Creation | 21 | Provide a safe sample brief and asset, an accessible-output checklist and an alternative when tools are unavailable. |
| 7. Research and Evidence | 21 | Include a small source packet and a worked claim/evidence table. |
| 8. Data and Decisions | 20 | Provide a small downloadable clean/dirty dataset, a worked calculation and an appropriate chart. |
| 9. Meetings and Coordination | 19 | Provide a fictional transcript and a model action log with owner and due date. |
| 10. Business Adoption and ROI | 22 | Add a numerical ROI example and a template that makes assumptions and uncertainty visible. |
| 11. Automation, Agents, and Codex | 24 | Provide a safe workflow template and four test cases; do not require an unsupported beginner to build a live agent. |
| 12. Course Review and Reference | 27 | Supply the three review scenarios the activity requests; make glossary/reference material easy to revisit across the course. |

Cross-course priorities: use fictional/public data, provide complete starting inputs, show one worked answer before independent practice, define technical terms at first use, and keep human checking central. Preserve the workplace focus. Add capstone templates, a submission file checklist, examples and a scored rubric rather than expanding it into another reading module.

## Captured walkthrough — numbered steps and health

Health describes the observed screen and relevant source findings, not a claim that every backend path was exercised. All screenshots were captured and inspected during this review. The sign-in image intentionally includes only the form, excluding the demo-credential panel.

| Step | Screen / evidence | Health and concise note |
| --- | --- | --- |
| 1 | [Module catalog](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/01-module-catalog.png) | Needs work: oversized Introduction tile and mixed completion meanings. |
| 2 | [Learning player](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/02-learning-before.png) | Improved cosmetically; shared progress and mobile behavior still need work. |
| 3 | [Activity workspace](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/03-activity-before.png) | Needs work: useful fields, inconsistent frame and submission safeguards. |
| 4 | [Study notes](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/04-notes.png) | At risk: device-only fallback and missing initial dialog focus. |
| 5 | [Graded assessments](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/05-graded-assessments.png) | Mixed: correct one-attempt display; unclear unlock requirements and weak bank. |
| 6 | [Assignments](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/06-assignments.png) | Mixed: good homework/project grouping; rubric and grade contribution unclear. |
| 7 | [Discussion and reply](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/07-discussions.png) | Usable: replies/emojis present; test content and moderation need attention. |
| 8 | [Resources](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/08-resources.png) | Needs work: working ebook, incomplete library and unavailable release schema. |
| 9 | [Live meetings](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/09-live-meetings.png) | Needs work: stale sessions, missing join links, obsolete instruction. |
| 10 | [Course home](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/10-course-home.png) | Mixed: announcement correctly on top; progress and course copy disagree. |
| 11 | [Dashboard](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/11-dashboard.png) | Usable: named greeting and overview first; progress definition and density need work. |
| 12 | [Messages / Q&A](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/12-messages.png) | Needs work: correct enrolled-course scope, incomplete conversation display. |
| 13 | [Profile](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/13-profile.png) | Mostly usable: upload control present; long email overflow. Upload not exercised. |
| 14 | [Certificates](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/14-certificates.png) | Good placeholder; conflicting subtitle corrected. |
| 15 | [Mobile activity](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/15-mobile-activity.png) | Needs work: outline unavailable and nested scrolling. |
| 16 | [Mobile More menu](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/16-mobile-menu.png) | Menu stacking works; primary-tab overflow remains difficult to discover. |
| 17 | [Sign-in form](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/17-signin-form.png) | Works: demo admin and student login verified. Password reset not tested. |
| 18 | [Admin account menu](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/18-admin-menu.png) | Good: menu appears above dashboard cards; no z-index issue reproduced. |
| 19 | [Course Studio](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/19-course-studio.png) | Mixed: helpful structure, readiness is not a complete delivery check. |
| 20 | [Resource authoring](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/20-resource-authoring.png) | At risk: release wizard present but database support missing; existing resource editing needed. |
| 21 | [Gradebook](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/21-gradebook.png) | Mixed: weights correct; indistinguishable learner names and limited rubric structure. |
| 22 | [Learning after fixes](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/22-learning-after.png) | Improved: outcomes span the content area and Next is visible. |
| 23 | [Assessments after fixes](D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04/23-assessments-after.png) | Improved: actions align across the row. |

## Validation and limits

- Passed: TypeScript check, ESLint, course-content validation, migration-structure validation, production build and `git diff --check`.
- Content validator confirms 13 modules, 286 screens, 12 module checks, 228 question instances, 13 activities and 8 assignments.
- Browser review used desktop 1287 × 912 and mobile 390 × 844; desktop restored afterward. Next was visible on the first two Module 1 screens after the sizing fix.
- The existing textbook returned HTTP 200 with PDF content type. No resource access restrictions were bypassed.
- Demo student and admin login worked. Shared teaching/resource/gradebook screens were reviewed through admin access; a separate instructor-only permission session was not tested.
- No graded attempt, activity submission, upload, post, reply, grade edit, migration or enrolment change was performed. Locked assessment paths were not bypassed. Transaction/race concerns are source-review findings, not reproduced attacks.
- No full screen-reader, formal contrast, production-load or penetration test was performed. The production URL and production deployment were not verified.
- All 286 screens were structurally scanned, with manual samples across every module. This is not an exhaustive ebook-to-LMS fidelity certification or a formal sixth-grade readability certification.

The audit's screenshots and diagnostic scripts are in `D:/CODEX/SynergyAcademy/tmp/lms-audit-2026-09-04`. This report is in `docs/reviews`. The cosmetic changes remain local for review.

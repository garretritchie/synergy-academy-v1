# MVP v2 — Course Delivery Companion

Status: approved plan, implemented locally on `codex/mvp-v2`, 18 September 2026. See [MVP_V2_IMPLEMENTATION.md](MVP_V2_IMPLEMENTATION.md) for current scope, v1 rollback, verification and remaining hosted/content gates. The audit and baseline below describe the pre-implementation state.

## Direction and source of truth

The supplied **Synergy Academy Course Delivery Companion — Revamp Project Plan** is the MVP v2 product brief. It supersedes the broader LMS priorities in the previous plan. The eBook is the authoritative learning resource; the portal supports preparation, reinforcement, practical work, assessments and live delivery. AI Business Essentials is the beta course, while the platform remains course-agnostic.

**User clarification:** do not combine the seven components into one interface. Give each component a dedicated section with an appropriate interface. Tracking each student's completion of each component is essential.

The module overview is therefore an orientation and status screen only. Its checklist links to dedicated component screens; it does not embed seven players, editors and forms into one long page. Existing Synergy branding and responsive accessibility conventions remain the visual foundation.

## Audit scope and limitations

Inspected local routes, navigation, student and instructor screens, types, content package, migration sources and verification scripts. This is a source audit with local checks, not a certification of the hosted application. Live database definitions, storage policies, signed-in role behavior and actual course assets still need deployment-specific verification.

The checkout is on `main`, with existing uncommitted role-view work in `AuthContext.tsx`, `RoleViewContext.tsx`, `roleView.ts`, `verify-role-view.mjs` and its review note. Preserve that work. Keep `Prompts/` private and ignored. Do not publish, seed or apply migrations as part of this plan.

## Existing-feature assessment

KEEP means reuse the implementation, subject to validation. SIMPLIFY means retain the underlying capability and reshape its workflow. DEFER means preserve working routes and records while removing their prominence. REMOVE applies to conflicting behavior, not destruction of historical data.

| Existing feature | Treatment | Repository evidence | MVP v2 action |
|---|---|---|---|
| Authentication and password recovery | KEEP | `src/context/AuthContext.tsx`, `src/pages/auth/`, `ProtectedRoute.tsx` | Preserve sign-in, role checks and pending-access behavior. |
| Multiple roles and workspace selection | KEEP | `RoleViewContext.tsx`, `RoleViewSwitcher.tsx` | Preserve student-first sign-in work and manual role switching. UI role selection is not authorization. |
| Courses and categories | KEEP | `AdminCourses.tsx`, `AdminCategories.tsx`, migration 002 | All five requested categories exist in the seed. Verify the beta course is linked to Business Applications. |
| Cohorts and manual enrolment | SIMPLIFY | `AdminCohorts.tsx`, `AdminEnrolments.tsx` | Retain cohort delivery dates, instructor assignments and existing identifiers. |
| Student dashboard | SIMPLIFY | `StudentDashboard.tsx` | Replace course-selection-first hierarchy with current module, continue action, this week's work, next class, outstanding work and grade summary. |
| Course welcome | SIMPLIFY | `CourseHome.tsx`, course introduction-video fields | Add a compact welcome with instructor, progress and next module; reuse existing course assets. |
| Curriculum and lesson blocks | SIMPLIFY | `AdminAcademic.tsx`, `LessonPage.tsx`, `StoryboardScreen.tsx` | Reuse ordered blocks for concise recap pages. Preserve full legacy lessons and records. |
| Module/component architecture | ADD | `learningPath.ts` currently models only learn/do/assess | Introduce configurable, ordered component references and independent completion. |
| Video | KEEP / EXTEND | `LessonPage.tsx` renders uploaded video with native controls | Give video a dedicated component screen; support hosted URLs and safe YouTube embeds, with completion. |
| Audio | ADD | No dedicated audio component/player found in inspected learning renderer | Dedicated audio screen, position, duration, resume and explicit completion. Persistent playback is secondary. |
| Guided activities | SIMPLIFY | `CourseActivities.tsx`, `courseFormatting.ts` | Reuse objective/instructions/checklists; make evidence requirements explicit and configurable. |
| Private evidence and submission history | KEEP | `CourseAssignments.tsx`, `CourseActivities.tsx`, migrations 012/025/028 | Preserve private bucket, signed links, drafts, revisions, history, late status and graded locks. Validate required evidence on the server. |
| Instructor submission review | SIMPLIFY | `InstructorGradebook` in `InstructorPages.tsx` | Separate a submissions queue from grade configuration; retain feedback and return-for-changes workflow. |
| Assessment engine | KEEP / SIMPLIFY | `CourseAssessments.tsx`, migrations 017/018/023/030 | Reuse server grading and attempt sessions. Present MCQ, multiple select and true/false for beta; retain other working types outside the main authoring path. |
| Resources and downloads | KEEP / EXTEND | `CourseSupportPages.tsx`, `AdminResources.tsx`, migrations 019/022/029 | Dedicated module resource section and course resource library; add supported YouTube embedding. |
| Drip release | KEEP / EXTEND | `AdminReleaseRules.tsx`, `is_lesson_released`, migration 004/012 | Retain scheduled/relative release; add explicit manual lock/release and assigned-instructor controls across all components. |
| Live classes and meeting links | KEEP / EXTEND | `CourseLive.tsx`, `InstructorLiveSessions`, `live_session_modules` | Reuse module-session linking table, dates, instructor and Zoom fields. Add preparation counts from component status. |
| Attendance | KEEP / EXTEND | `InstructorAttendance`, `CoursePerformance.tsx` | Preserve present/late/excused/absent; add Mark All Present and dedicated student attendance history. |
| Student grades | SIMPLIFY | `CoursePerformance.tsx`, `StudentDashboard.tsx`, `CourseHome.tsx` | Use one grade calculation and show all expected graded items, including unsubmitted/ungraded work. |
| Instructor gradebook | SIMPLIFY | `InstructorGradebook` | Add a cohort/student grid as the primary view; retain authorized corrections and existing category configuration as secondary tools. |
| Progress and resume | KEEP / EXTEND | `useLearningPath.ts`, `learningPath.ts`, `lesson_bookmarks`, `progress_records` | Preserve old lesson records/bookmarks and map them explicitly; add component-level state and shared aggregate calculations. |
| Instructor profile | KEEP / EXTEND | `profiles`, `instructor_profiles`, existing course instructor panel | Surface title, qualifications, bio, photo and welcome media; do not create a duplicate profile system. |
| Instructor dashboard | SIMPLIFY | `InstructorDashboard.tsx` | Replace general counts with next class, preparation, review queue, missing work, failed checks and next release. |
| Announcements and in-app notifications | KEEP, secondary | Existing announcements/notifications tables and UI | Keep course notices accessible; add focused events only where missing. No email expansion prerequisite. |
| Discussions and Q&A | DEFER | `CourseDiscussionBoard.tsx`, communication components | Remove from primary student course navigation; retain working moderation and historical data. |
| Direct messaging | DEFER, preserve | `StudentMessages.tsx`, `DirectMessagesPanel.tsx` | Secondary instructor contact/legacy access, not the student home-page focus. |
| Certificates and public verification | DEFER, preserve | `features/certificates/`, certificate routes | Existing certificates continue to work. No new certificate scope before companion delivery. |
| Public catalogue | DEFER, preserve | `pages/public/PublicCourses.tsx` | Preserve public routes but remove marketplace emphasis from portal flows. |
| Organizations, contracts and company seats | DEFER from beta navigation | `AdminAccess.tsx`, `OrganizationSeats.tsx`, migration 013 | Preserve entitlements and records. Do not weaken access checks when hiding administrative controls. |
| Reporting | SIMPLIFY / DEFER | `AdminReporting.tsx` | Keep necessary operational visibility; defer enterprise reporting. |
| External-system links | KEEP foundation, DEFER integration | migration 011 | Preserve integration identifiers; build no CRM/registration/payment integration. |
| Learning paths, gamification, AI tutor, payments | DEFER new development | Current internal learning-path helper is sequencing, not a separate pathway product | No new marketplace, XP, badges, leaderboard, payment or tutor surface. |
| Course-specific behavior in reusable UI | REMOVE coupling | `CourseActivities.tsx` checks course slug; `PracticePacket.tsx` imports beta-only JSON | Move packet selection to content/resource references. Keep legitimate course-specific content in data. |
| Conflicting metrics and hidden release assumptions | REMOVE behavior | Details below | Replace with shared, explicit completion, grade and access rules. |

## Findings that affect implementation order

1. **Independent component completion is missing.** `PathStep` has only learn/do/assess. Its percentage counts all path steps equally; it has no required/optional component distinction and no audio/video/resource/attendance completion sources.
2. **Course progress has multiple denominators.** The learning path counts returned lessons, activities and practice checks; `CoursePerformance` measures released lessons. Lesson RLS filters unreleased rows, so client-side counts alone cannot reliably represent the entire required course. A metadata-only outline must expose safe counts without exposing locked content.
3. **Grades disagree between screens.** Dashboard uses a simple mean of scored grades; course home includes null percentages as zero; performance uses category weights. Use a single server-backed formula and distinguish current grade from final grade. Do not silently replace existing assessed-course weights.
4. **Manual locked state is not first-class.** `is_lesson_released` returns true when no rule exists and bypasses release for self-paced courses. Scheduled/relative release is reusable, but beta companion modules need an explicit lock, safe missing-date behavior and a migration that does not suddenly open or close legacy courses.
5. **Module access must cover every content source.** Migration 012's assignment/assessment SELECT policies allow published, enrolled rows when `lesson_id` is null, even when `module_id` exists. Later assessment readiness checks constrain attempts, but do not by themselves hide the underlying assignment/assessment row. Verify and close module-level read, write, media and RPC gaps before claiming drip protection.
6. **Instructor release UI and authority need work.** Release-rule editing currently has an administrator route and administrator write policies. Merely adding an instructor navigation link is insufficient; assigned-cohort authorization needs explicit server enforcement.
7. **Existing assessment policy differs from the new configurable companion.** Module practice checks currently stay outside the official grade and allow repeat attempts. Preserve existing academic outcomes; make grade participation and pass-versus-submit completion configurable for new companion components.
8. **Media support is incomplete.** Uploaded videos play inline; the inspected renderer opens other video URLs externally. Dedicated audio, YouTube embedding and media-specific completion remain to build.
9. **Real content needs reconciliation.** Local validation reports introduction + 12 modules, 298 screens, 12 module checks, 228 assessment questions, 12 activities and 8 assignments. README still describes 286 screens. These existing screens are source material, not automatically the concise v2 recap. The current seeder references textbook v3.8; the beta-authoritative eBook edition, media and schedule must be confirmed before conversion/loading.
10. **Migration history has duplicate representations.** Canonical source migrations and Bolt-recorded `.sql.sql` copies coexist. Reconcile the deployed migration ledger before rollout; do not apply both representations or run an old content seed indiscriminately.

## Student information architecture

Primary navigation: **Dashboard · My Course · Grades · Attendance · Resources · Profile**. When multiple active enrolments exist, show a course switcher and preserve that context; never select a course by its title or slug. One beta enrolment opens directly into its companion experience.

Within a course: **Overview · Modules · Live Classes · Resources**. Grades and attendance remain easy to reach from the main navigation and dashboard. Existing deep links receive compatible routes or redirects during transition.

Dashboard order: current course and overall required-component progress; dominant Continue Module action; current released module and its component statuses; next live class with meeting information; outstanding released work; grade summary. Unreleased work is upcoming, never overdue. A completely caught-up student sees the next release/class rather than a misleading unfinished task.

### Dedicated component screens

| Section | Interface | Completion evidence |
|---|---|---|
| eBook Recap | Ordered visual cards/pages, page count, previous/next, source eBook reference, resume position | Reach final page, then confirm recap complete. |
| Video Explainer | Responsive player, title, description, duration, captions/transcript where supplied, module return link | Explicit Mark complete for beta; started/position separately. End-of-play detection may assist later. |
| Audio Recap | Audio-focused player with seek, duration, position and optional speed/download | Explicit Mark complete for beta; saved listening position. |
| Activities / Coursework | Activity list, then dedicated guided activity workspace with steps, evidence requirements and private submission form | Successful finalized submission; draft or failed upload is incomplete. Returned work becomes outstanding. |
| Assessment | Assessment introduction, question flow and results screen; no unrelated module tools mixed into the attempt | Server-accepted attempt meeting the configured submitted/passed rule. |
| Resources | Required and optional files, eBook/slide downloads, supported embedded videos and links | Optional by default; explicit Reviewed state if required. Opening a link alone is not proof of review. |
| Live Class | Session date/time, instructor, joining details, preparation status, notes and attendance result | Authorized attendance record, never a student checkbox. |

Proposed routes: `/student/courses/:cohortId/modules/:moduleId` for the overview, and `/student/courses/:cohortId/modules/:moduleId/components/:componentId` for a type-selected dedicated screen. Existing assignment and assessment records remain the backing objects. Keep a shared module heading, progress indicator and return navigation across screens, with one relevant mobile action. Do not place all component bodies in an accordion, tab panel collection or single scrolling page.

## Data and access design

### Reuse first

Keep `profiles`, `instructor_profiles`, `courses`, `course_categories`, `course_category_links`, `cohorts`, **`enrolments`** (existing spelling), `modules`, `lessons`, `lesson_blocks`, `resources`, `assignments`, `submissions`, `submission_files`, assessment/session/answer tables, `grade_categories`, `grade_items`, `grades`, `live_sessions`, `live_session_modules`, `attendance_records` and notifications. Preserve primary keys and historical submissions/attempts.

Propose an additive `module_components` definition containing module, type, title, description, order, enabled/published/required flags and validated type-specific settings. Reuse lessons/ordered blocks as recap content rather than adding a duplicate recap authoring store. Link activities, assessments, resources and live sessions through validated references; do not put unvalidated foreign IDs or private media URLs into outline-visible JSON.

Course modules are reusable while assignments, assessments and sessions can be cohort-specific. Add a component-to-cohort delivery binding where needed. Validate that every bound record belongs to the same course/cohort; do not attach one cohort's assignment globally to all deliveries of a module. Prefer typed foreign keys/link tables over an unchecked generic ID.

Add `component_progress`, scoped by enrolment and component, for recap/media/resource acknowledgements and resume metadata. Its unique key prevents duplicate completion. Preserve `progress_records` for legacy lessons. Explicitly map old completed lessons to the corresponding recap only after reviewing the content mapping; never infer video/audio/activity completion from lesson completion.

### Authoritative completion projection

Return a unified component-status view/RPC that derives activity, assessment and live-class completion from their existing records. Students cannot write those completion types directly. Manual completion writes must verify identity, active access, module release and component type. Store `not_started`, `in_progress`, `completed` and `completed_at` for applicable acknowledgements; preserve detailed submission and assessment states beside them.

For a component containing several activities or required resources, complete it only when all required child items meet their rules. Keep optional child items out of the required count. Returned submissions and corrected attendance must recompute status consistently without deleting history.

Module progress = completed required enabled/published components / required enabled/published components. Course progress uses that count across the entire configured course, including future required components; expose only their safe outline metadata. Zero required items means **No required items**, not an unexplained 100%. Optional completion can be displayed without inflating course progress.

Also show a separate **released work** measure for Caught Up/Work Outstanding and class preparation. Preparation excludes the live class itself and optional items. A student can be caught up while overall course progress is below 100%.

Proposed attendance default: present/late count toward live-component completion; absent does not; excused is explicitly waived or excluded by the course rule. Preserve existing left-early records and require a documented rule. Missing attendance stays pending, not automatically absent. These are proposed defaults requiring course-policy confirmation.

### Release and privacy boundaries

Separate publication, cohort release and completion prerequisites. Default new companion modules to locked until manually released or scheduled; retain relative release as a secondary option. Do not silently reinterpret legacy courses. Relocking preserves academic records and requires a clear impact review when learners have begun/completed work.

A shared server access decision must protect recap blocks, media metadata, storage signing, activities/evidence requirements, assessment question delivery and completion writes. Locked overview metadata may include title, order, release date and required count, never the actual materials or answers. Assigned instructors manage their deliveries; administrators retain authorized oversight; student A cannot read student B's records or files.

Reuse private `assignment-submissions` storage and private course assets for protected materials. Public course promotional assets remain separate. Enforce evidence type/size/requiredness before final submission. Keep old signed links short-lived and account for their lifetime in relock semantics. Assessment answer keys stay server-side until configured review disclosure.

## Delivery phases and exit criteria

| Phase | Concrete deliverable | Completion gate |
|---|---|---|
| 1 — Audit, shell and foundation | This assessment; revised role navigation; additive component/binding model; compatible routes | Existing sign-in/roles/data preserved; new model supports a second course without code branches. |
| 2 — Student clarity and release | Dashboard, course welcome, module list/overview, safe outline, explicit release controls, shared progress projection | Student sees next released work; direct API access to unreleased content fails; optional items do not distort progress. |
| 3 — Dedicated recap/media/resources | Separate recap, video, audio and resource screens, independent resume/completion | Reload/cross-device persistence; accessible mobile controls; required resource and media states remain independent. |
| 4 — Activity evidence | Guided authoring, evidence requirements, private submission and separate review queue | Successful submit completes activity; failed upload/draft does not; return/resubmit/grade history survives. |
| 5 — Assessments | Focused authoring and student flow using existing server engine | All three beta question types, attempts, passing rule, feedback/reveal and optional grade feed verified. |
| 6 — Live companion | Module/session links, class preparation counts, meeting details, attendance and Mark All Present | Assigned instructor can take attendance; student sees read-only history; completion follows attendance policy. |
| 7 — Grades and instructor operations | Consistent current grade, student item statuses, cohort grid and instructor attention dashboard | Same calculation on every screen; zero scores, ungraded items and corrections handled correctly. |
| 8 — Real beta content | Approved eBook-derived recaps, actual videos/audio, activities, questions, PDFs, links and real session dates | Content manifest reconciled against authoritative eBook; no fabricated content, scores or schedule used as beta data. |
| 9 — Beta acceptance | Phone/tablet/desktop, student/instructor/admin workflows, cross-account RLS and storage verification | Full supplied acceptance scenario passes on the intended deployed version. |

Security and completion tests belong in each affected phase; phase 9 is the full end-to-end gate, not the first access-control check.

## Migration and rollout sequence

1. Capture current deployed schema/migration ledger and record counts before designing the final migration. Do not assume checked-in SQL equals hosted state.
2. Add component definitions, delivery bindings, progress and access functions without deleting existing structures.
3. Build an idempotent, reviewable mapping for one complete real module. Keep content conversion separate from schema deployment and preserve old grades/attempts.
4. Validate the full vertical flow in isolation, including two students and an unassigned instructor, then enable companion mode for the selected course/cohort.
5. Convert the remaining modules using reviewed mappings and real assets. Keep legacy routes available while records transition.
6. Deploy only through the agreed release workflow. Validate as an ordinary student after deployment, not only as an administrator. Rollback should restore the prior UI/mode while retaining newly created academic records.

## Acceptance checklist

- Student logs in, sees current course/overall progress and one dominant continue action.
- Every module component opens its own appropriate interface and has independent status.
- Recap resume, video/audio started state and confirmations persist across reload/device.
- Future modules expose only permitted outline metadata; direct URLs, database reads, RPCs and private-file signing cannot bypass the release rule.
- Manual, scheduled and relative release behave at the boundary time; admin/instructor rights respect assignment scope.
- Submission evidence is private; another student and an unassigned instructor cannot list, read or sign its files.
- Drafts/partial uploads do not complete work; successful submit, returned work, resubmission and grading produce the correct state and retain history.
- Multiple-select grading requires the intended exact answer set; passing boundaries, exhausted attempts, concurrent/repeated submits and answer-reveal settings are verified.
- Assessment and activity grades feed the same course formula everywhere; null is ungraded, zero is a real score.
- Optional/disabled components do not inflate required progress; future required components remain in overall progress; released-work status is separate.
- Class preparation excludes attendance; cancelled sessions do not create outstanding attendance; attendance corrections recompute live-component status.
- Student grades and attendance are read-only; instructor can review and correct only assigned records.
- Empty enrolment, all-locked, caught-up, completed, expired/inactive access, loading, failure and missing-asset states are explicit.
- Phone, tablet and desktop flows support keyboard/focus, readable recap pages, file uploads, media controls and assessment navigation without horizontal student tables.
- Actual content and schedules are verified before beta; local fixtures and development preview material are not production seeds.

## Decisions and content inputs to resolve before loading

The architecture can proceed without inventing course facts. Confirm the authoritative eBook edition/module map, media locations, instructor welcome material, actual cohort timetable and meeting details before loading. Confirm whether existing homework/capstone/exam weights carry into the beta or whether a new cohort receives a simpler formula; preserve historical grades either way. Confirm required components, attendance treatment, assessment pass/submit rules and whether released modules require prior-module completion.

## Baseline verification

- `npm run verify:path`: passed existing sequencing, optional learn/do/assess combinations, release explanations and score gates.
- `node scripts/verify-submission-policy.mjs`: passed ungraded revision and graded-lock behavior.
- `npm run verify:sessions`: passed isolated PostgreSQL migration/assessment/submission/resource-audience/bookmark/record-management checks through migration 031. Auth and storage are stubs; extension-only migration 016 is excluded. No remote database was changed.
- `npm run verify:course`: passed current content package checks; reported 13 modules, 298 screens, 12 module checks, 228 questions, 12 activities and 8 assignments.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; Vite reported an outdated Browserslist data warning.
- `git diff --check`: passed for the tracked working-tree changes; existing role-view edits remain untouched.

These checks validate the existing implementation under their stated conditions. They do not establish that MVP v2 is implemented, that its final content is ready, or that hosted RLS/storage and real-device flows have passed.

Design housekeeping: the existing `.impeccable/design.json` sidecar is older than `DESIGN.md`. Refresh it from the authoritative design document when design implementation starts; this does not block the product audit.

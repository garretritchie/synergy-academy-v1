# Build-plan alignment

This review reflects the implementation in this repository on 2026-08-19.

## Beta operating chain

| Area                   | Status                                      | Implementation                                                                                             |
| ---------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Authentication         | Ready                                       | Bolt Supabase sign-in/sign-up, password reset, pending-access state, protected routes                      |
| Multi-role access      | Ready                                       | RLS-backed roles and workspace switching; no role selector at sign-in                                      |
| Users                  | Ready                                       | Account activation and multi-role assignment for existing Supabase users                                   |
| Catalog                | Ready                                       | Category and course create/edit, multi-category assignment, draft and published states                     |
| Cohorts                | Ready                                       | Scheduled cohorts, capacity, enrolment state, and lead-instructor assignment                               |
| Enrolment              | Ready                                       | Student enrolment lifecycle and automatic certificate record on completion                                 |
| Access entitlements    | Foundation ready after migration 013        | Course/platform terms, organizations, main contacts, capped seats, manager self-service, and a shared access-check function; self-paced learner routing follows commerce launch |
| Curriculum             | Ready                                       | Ordered modules/lessons, previous/next navigation, progress tracking, and safe text, list, table, callout, prompt, knowledge-check, reference, image, video, and resource blocks |
| Content release        | Ready after migration 012                   | Immediate, scheduled, days-from-start, and previous-lesson completion rules                                |
| Course resources       | Ready after migration 012 for private files | Course/module/lesson-scoped links and private uploads; lesson assets inherit drip-release access            |
| Live classes           | Ready after migration 013 for uploads       | Instructor scheduling, meeting links, preparation notes, cancellation, student joining, and private recording uploads |
| Attendance             | Ready                                       | Per-session roster and present/late/excused/absent records                                                 |
| Assignments            | Ready                                       | Instructor creation, written/file submission, late status, private instructor review                       |
| Quizzes                | Ready after migration 012                   | Multiple choice/select, true/false, short/long answer, safe delivery, server grading, and written-response review |
| Gradebook              | Ready after migration 012 for quiz grades   | Assignment/quiz feeds, manual grade items, validated category weights, weighted student grade, and feedback |
| Student performance    | Ready                                       | Lesson progress, attendance, grade average and grade-item detail                                           |
| Communication          | Ready after migration 012                   | Cohort announcements, discussions, Q&A, notifications, private messages, and staff-only enrolment notes    |
| Completion             | Ready after migration 012                   | Persisted completion evaluation, weighted final grade, certificate issue/revocation, printable PDF, and public verification |
| Reporting              | Ready for beta                              | Live operational counts for accounts, courses, cohorts, enrolments, sessions, submissions and certificates |
| Public architecture    | Ready after migration 013                   | Safe published-course catalog, category routes, course outlines, sign-in/account CTAs, and no checkout coupling |
| Branding/responsive UI | Ready                                       | Compact Synergy typography, premium blue/neutral surfaces, logos, palette, favicon, desktop/mobile layouts, route-level loading, and empty/error/loading states |

## Required before the first real cohort

1. Sync and apply migrations 012 and 013 in Bolt Supabase. Migration 013 enables organization contracts and cohort-independent access entitlements.
2. Add the approved AI Business Essentials curriculum and assets; this repository does not contain authoritative final course material.
3. Add real instructor and student accounts, assign roles, and create the production cohort.
4. Add the local and production password-reset URLs to Supabase Authentication URL settings.
5. Run the local verification commands and complete one manual role-based acceptance pass before publishing.

Migration 012 also applies assessment answer-key protections and manual-review RPCs, automatic event notifications, audit and academic-integrity triggers, database-enforced drip access, completion evaluation, private messaging/notes policies, and tighter profile visibility rules. Until it is applied, the new storage, safe quiz/completion RPCs, staff-note workflow, and private-message interface will report that their backing database objects are unavailable.

## Deliberately post-beta

The supplied plan explicitly allows payments, checkout, CRM synchronization, and deeper external automation to follow the first operational course. A safe public catalog and course-detail surface are present, but they do not self-enrol or infer access from a browser payment state.

## Known scope notes

- Account creation is self-service followed by administrator role approval. Creating Auth users directly from the browser is intentionally avoided because it would require exposing service-role authority.
- Meeting links are platform-neutral and support Zoom URLs without requiring a Zoom OAuth integration for beta.
- Lesson text uses a safe structured renderer rather than raw HTML. Administrators can combine headings, paragraphs, lists, media, callouts, quotes, checklists, prompts, and links without exposing executable markup.
- Certificate records include a non-enumerable verification code, public verification page, printable output with a scannable verification QR, and audited administrator revocation. QR rendering uses QuickChart and includes the verification URL as a printed fallback.
- Announcement and course-resource creation use guided review workflows. Resource and lesson-media workflows default to direct private uploads; external links remain available when the resource is intentionally hosted elsewhere.
- Assignment submissions retain immutable attempt snapshots, attempt-aware files, late status, grade, and feedback. A richer announcement scheduler remains a post-beta workflow refinement.
- Payment checkout, invoicing, renewals, and provider webhooks remain future integrations. The underlying individual, organization, course, platform, term, and capped-seat access model is implemented without coupling authorization to a payment provider.

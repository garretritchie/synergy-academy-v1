# Resource audiences

## Staff workflow

Open Course Resources (administrator) or Teaching Resources (instructor), select a program/course, then New resource.

1. Describe: title, description, and uploaded file or web link format.
2. Audience: explicitly choose This cohort only or All program participants. Cohort-only resources require a cohort; instructors can select only cohorts assigned to them.
3. Release: immediate, scheduled, or after a completion checkpoint. Existing locked previews remain available.
4. File or link: upload the file or enter an HTTP(S) link, review audience and release details, then publish.

Program resources are stored once with a NULL cohort_id. They serve all current and future enrolled cohorts of the same program, without copying the resource. They are not public catalog content. A cohort-specific resource has that cohort_id and does not carry forward.

Shared program resources support learning-completion checkpoints. Assessment and activity records belong to individual cohorts, so those checkpoint types require a cohort-only audience. Release decisions are evaluated in the cohort the student is currently viewing, even when that student has multiple enrolments.

Existing resources retain their existing audience. Staff can edit audience and release details without re-uploading an existing file.

## Deployment

Apply `supabase/migrations/20260911000100_029_resource_audience_context.sql` after the existing migrations and before releasing this frontend. It adds the cohort-context resource RPC and tightens staff SELECT scope. The student Resources page intentionally does not fall back to the older cross-enrolment query if this migration is missing.

No hosted database migration, resource publication, or GitHub push was performed for this change.

## Verification

- TypeScript and ESLint passed.
- Production build passed (existing outdated Browserslist data warning).
- SQL structure check passed.
- Isolated PostgreSQL session tests passed, including cohort-only isolation, future cohort inheritance, non-enrolled denial, multi-enrolment context, independent cohort release gates, safe locked previews, instructor audience permissions, and anonymous RPC denial.
- Existing assessment, submission, resource timing, and moderation regression tests passed.
- Database tests use stub auth/storage and exclude extension-only migration 016; they are not a hosted Supabase deployment test.
- Local dev server starts at http://127.0.0.1:5174. Browser opens successfully, but the existing session is Demo Student and redirects the staff resource route to the student dashboard. Staff form visual QA requires an instructor/admin session. The existing session was not signed out or replaced.
- No live file upload or publication was attempted.

# Safe record management

## User access

Admin → Users & roles now has explicit **Disable user / Enable user** actions,
separate status badges, account-status filters, refresh, and confirmation dialogs.
Disabling is reversible; enrolments, work, grades, and messages are retained.
Permanent user deletion is intentionally not exposed by this change.

Existing role/enrolment functions check the profile's active flag. Migration 031
also blocks non-administrators from changing that flag, including self-reactivation.
The current administrator cannot disable their own account. The browser refreshes
profile/role access on return to the app and every minute while visible. This is
application access control, not deletion of the Supabase Auth identity or a global
revocation of all issued tokens.

## Accidental records

Delete controls are added to live sessions, assignments, assessment management,
announcements, cohorts, and categories. Staff see a named-record confirmation and
must type DELETE. Database permission/dependency checks run both before confirmation
and again in the deletion transaction. Direct DELETE calls have the same guard.

Linked student history blocks deletion, including attendance, submissions, attempts,
grades, and enrolments. Resource release checkpoints also block deleting their
assessment/activity. Session content links, an unused assessment's questions, and an
empty cohort's instructor links can be removed with their parent; the underlying
lessons, resources, and instructor accounts remain. Deletions are audited.

Instructors can only delete records belonging to cohorts they teach. Cohorts and
categories are administrator-only. A session with attendance can be cancelled instead.
Deleting an LMS session does not cancel Zoom, purge uploaded recordings, or recall email.

## Release

These changes are local until explicitly pushed and published.

1. Sync the code through GitHub/Bolt when approved.
2. Apply only the new pending migration:
   `20260911200000_031_safe_record_management.sql`.
3. Redeploy `admin-create-user` for its new active-administrator check.
4. Verify the deployed staff pages. Do not rerun earlier applied migrations.

No real records were deleted/disabled during verification. TypeScript, ESLint,
production build, and the isolated PostgreSQL suite were run. The database fixture
tests authorised deletion, cross-cohort denial, linked history, checkpoint dependencies,
direct-delete bypass attempts, audit records, stale titles, self-lockout,
self-reactivation, re-enable, and anonymous denial. Auth/storage are test stubs.

The actual account confirmation component was visually checked at desktop and phone
widths in an isolated UI harness, with 44px action targets and restored keyboard focus.
The real deletion component correctly blocks action with a migration-required message
against the current database. Full staff-page browser testing remains pending an
administrator sign-in in the local preview; the existing local session is a student.

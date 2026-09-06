# Submission revisions until grading

## Rule

Activities, homework, and projects accept revisions until grading. Saving a draft does not consume an attempt; submission revisions remain counted for history but no longer have a maximum attempt cap. Grade 0 counts as graded, as does a grading timestamp or graded status. Students cannot clear those fields to unlock work. Existing publication, enrolment, learning prerequisites, release dates, and submission deadlines still apply.

Graded quiz/exam sessions retain one attempt plus explicit instructor grants. Practice checks remain repeatable.

For already-submitted work, a revision draft stays on the current device. The original remains submitted and the learning path remains complete until the student chooses **Update submission**. Selected files must be uploaded before leaving. Initial drafts still save to the account. Every submitted revision retains a content-history snapshot. Existing submitted evidence cannot be deleted by a student; graded evidence cannot be appended, altered, or deleted.

## Deployment

Apply all pending migrations in filename order, through `20260906000100_028_revise_submissions_until_graded.sql`, using Bolt/Supabase. In particular, 025 corrects draft attempt counting, 027 repairs eligible historical draft counters without deleting work, and 028 introduces this policy. Do not rerun already-applied migrations manually.

The local frontend alone does not change the connected Supabase trigger. Until migrations are applied, the app explains the legacy limit error rather than claiming the student used an attempt. No live database migration or real student submission was performed during these checks.

## Verification

- Isolated PostgreSQL tests apply migrations through 028, reproducing and repairing the legacy first-submit defect at 027.
- Three ungraded submissions with an assignment limit of 1 pass for activity, homework, and project; prior content remains preserved.
- Grade 0, stale browser updates, attempted grade clearing, evidence changes after grading, and ownership changes are protected by server rules.
- Staff clearing the grade/timestamp and returning work allows a further revision; ordinary student writes cannot do so.
- Existing graded assessment one-attempt/grant tests remain passing.
- Shared UI policy tests cover ungraded states, status/score/timestamp locks, and the older-database error explanation.

The database fixture uses auth/storage stubs and excludes extension-only migration 016; it is not a live Supabase deployment test.

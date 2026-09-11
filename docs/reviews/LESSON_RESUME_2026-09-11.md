# Lesson resume and parallel practice

## Student experience

- Save & exit returns from a lesson to Learning without completing the lesson or submitting work.
- Each viewed screen is bookmarked automatically. The status distinguishes account-synced saves from device-only saves and failed saves.
- Learning includes a saved-screen Resume lesson card (Resume review for an already-completed lesson). In-progress bookmarks also drive existing course/dashboard continue links.
- Legacy browser screen positions are retained. Invalid positions are clamped if a lesson changes length. Storage failures do not break the lesson.
- After the final Learn it lesson in a module is completed, the student can choose Do it or Assess it. Neither practice step requires the other. Multiple activities/checks also open together.
- Earlier-module completion gates, timed lesson releases, graded exam prerequisites, and graded attempt limits remain unchanged. Optional activities/checks remain optional course components.

## Deployment

Apply migration `20260911000200_030_lesson_resume_parallel_practice.sql` before deploying the new frontend. It adds private per-student/per-cohort lesson bookmarks and updates the server assessment-readiness function for parallel module practice.

Without the migration, bookmarks fall back to device storage and the UI explicitly reports account sync is unavailable. The old server may still refuse a practice check until its activity is complete, even though the new frontend displays the check as available. Release code and migration together.

No hosted migration or GitHub push was performed for this task.

## Verification

- TypeScript, lint, production build, path tests, bookmark utility tests, and isolated PostgreSQL tests passed.
- Path coverage: optional steps, multiple lessons, parallel activities/checks, unfinished learning, activity drafts, completing the check before the activity, prior-module gates, score requirements, and timed release explanations.
- Bookmark coverage: exact screen persistence, newer copy selection, account/cohort isolation, legacy positions, invalid positions, corrupt/full/unavailable local storage, row-level privacy, cross-course write rejection, and anonymous denial.
- Database tests retain existing graded-attempt, submission, resource audience, release, and moderation checks. Auth/storage are stubs; extension-only migration 016 and Bolt duplicate `.sql.sql` files are excluded.
- Local browser: opened a completed Introduction lesson, advanced to screen 2, saved and exited, saw Resume review at screen 2, and resumed that exact screen. Module 1 showed both Do it and Assess it as available with an unfinished activity. Existing legacy Module 1 position restored at screen 4.
- Browser account-sync testing used the device fallback because migration 030 is not applied. Cross-device hosted verification remains pending deployment. No work, grade, or assessment attempt was submitted during the walkthrough.

# Multi-role workspace views

The header now exposes a keyboard-accessible role selector for active users with
two or more assigned roles. It is available in desktop/mobile layouts and the
learning-course header, and remains available in the account menu.

The chosen role controls workspace navigation and the destination dashboard.
Selection is saved per user on the current browser, rather than using the former
shared `synergy-active-role` key. Deep links and browser Back/Forward determine
the view for role-specific routes; shared profile pages retain the selected view.
Login/home redirects respect the saved valid preference. Removed or invalid roles
fall back to an assigned role. Disabled, pending and temporary-password gates remain.

Instructor view scopes cohort and resource management to the user's instructor
assignments even when the account also has an administrator role. Student pages
continue to use that student's own enrolments and work.

This is a workspace view switch, not impersonation or a security sandbox. Assigned
database permissions remain unchanged; no roles or enrolments are granted by the
selector. Administrative privileges are not revoked from the session when viewing
another workspace, and this feature is not a substitute for testing RLS with a
separate student-only account.

No migration or backend deployment is needed. Changes remain local until pushed.

## Verification

- TypeScript, ESLint, production build and `node scripts/verify-role-view.mjs` passed.
- Pure role resolution tests cover all roles, deep links, saved preference,
  unassigned/removed roles, empty roles, per-user storage and storage failure.
- The actual selector component was exercised in an isolated browser harness at
  desktop, 393px and 360px phone widths: all three choices work, control height is
  44px, and the course-header fixture has no horizontal overflow.
- No live account was granted additional roles for testing. A full authenticated
  multi-role walkthrough is still pending an account already assigned multiple roles.

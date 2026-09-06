# Sign-in refinement — 5 September 2026

Scope: `/signin`. Preserve authentication, account creation, recovery, and environment-gated demo accounts. Other uncommitted LMS work is unchanged by this pass.

## Design

- Inset navy brand panel, quiet circular line accents, and a pale blue canvas.
- Compact form with the Academy brand, clear primary action, and password recovery next to its field.
- System typography retained; 48px inputs and primary action, 44px password toggle and demo buttons.
- Password visibility toggle with an accessible name and pressed state.
- Demo access remains available through a native expandable disclosure; selecting an account fills the form rather than silently signing in.
- Tablet and phone layouts prioritize the form and remove the decorative story panel. Phone inputs remain 16px to avoid focus zoom.
- Sign-in exceptions now produce a recoverable message and release the loading state.

## Verification

- TypeScript, ESLint, production build, and whitespace checks passed. Build reported the existing outdated Browserslist data notice.
- Rendered desktop at 1287×912 and 1366×768; compact laptop layout fits the viewport without vertical or horizontal overflow with demo access collapsed.
- Rendered mobile at 393×852 and 360×780, and tablet at 820×1180; no horizontal overflow. Expanded demo content and short screens can scroll normally rather than clipping controls.
- Exercised the password visibility control with a temporary test string, plus the demo disclosure and student-account selection. Demo credentials remain masked in the preview.
- Existing sign-in service and destination are retained; no live authentication, password-reset email, or account creation was performed in this visual pass.
- No database migration is required for these sign-in changes.

Premium skill guidance shaped spacing, hierarchy, restrained accents, and explicit focus/loading states. React guidance kept interaction state local and decorative content outside the component.

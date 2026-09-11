# Responsive course navigation review — 11 September 2026

## Delivered locally

- CourseLayout now reuses AppLayout's role-aware Academy navigation, account menu, drawer, focus handling and sign-out behavior. Course sections remain a separate navigation tier.
- Course sidebar: 192px with labels at 1280px and above; 72px accessible icon rail at 1024–1279px; drawer below 1024px. Icon links retain accessible names and native title hints.
- No duplicate Academy top bar inside courses. The course header contains the Academy drawer trigger, course switcher and account menu.
- Learning outline becomes a modal on narrower screens rather than competing with the Academy sidebar. Current module remains expanded in that modal.
- Compact, single-line Learn it / Do it / Assess it labels on phones.
- Shared safe-area padding, unrestricted pinch zoom, touch-friendly navigation and 16px form fields on tablets/phones or coarse-pointer devices. Existing responsive grids and scrollable lesson content remain intact.

## Browser verification

Used the local Vite preview with the existing demo student session. No activities, assessment attempts, messages, uploads or grades were submitted.

| Coverage | Result |
| --- | --- |
| Desktop 1440×900 lesson | Full Academy sidebar and contextual outline visible; lesson frame fits remaining height |
| Small desktop 1280×800 | Full sidebar; lesson frame contained; no horizontal overflow |
| iPad landscape-sized 1180×820 and 1024×768 | Compact Academy rail; course outline accessible in modal; no horizontal overflow |
| iPad portrait-sized 820×1180 and 768×1024 | Drawer navigation; activity/lesson stack to available width |
| Phone-sized 393×852, 390×844, 360×780 | Single-line workflow, drawer/More menu accessible; no horizontal overflow in checked lesson layouts |
| Student dashboard, course library, Messages, Profile at phone width | Rendered heading/layout checks; main area has no horizontal overflow; profile inputs use 16px text |
| Course home, Learning, Coursework, discussions, resources and live meetings at phone width | Loaded-page checks; main area has no horizontal overflow |
| Assessment review at phone width | Existing attempt review renders within frame; questions and feedback remain readable; no attempt created |
| Academy drawer | Focus moves into navigation, background inert; Escape closes and returns focus |
| Course outline modal | Current module expanded; available steps accessible; close control works |

Temporary viewport overrides were reset and the learning preview was left open.

## Checks and limits

- Production build, TypeScript, ESLint, learning-path tests, assessment/session PostgreSQL fixture tests and bookmark tests passed.
- Design detector ran once. It reported advisory existing typography/palette/radius differences against DESIGN.md; this scoped responsive pass preserves the approved incumbent visual design rather than rewriting its palette.
- Browser viewport checks are not physical device validation. iOS Safari, Android Chrome on hardware, virtual-keyboard behavior, assistive technology and every instructor/admin CRUD page have not been manually tested this pass. Shared AppLayout and form/touch improvements apply to those role layouts as well.
- No deployment or database mutation was performed. These changes remain local/unpushed alongside the preceding lesson-resume changes.
- Migration 030 from the preceding work is still needed on the connected database for account-synced lesson bookmarks and Learn-only practice prerequisites. Local navigation/layout improvements do not apply database migrations; the preview still reports device-only bookmarks and its old server prerequisite gate.

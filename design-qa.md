# Certificate system design QA

- Source visual truth: `C:\Users\garre\OneDrive\WORK\SYNERGY BAHAMAS\SB MARKETING\CERTIFICATES\2024\SB_Completion_Certificate.png`
- Browser implementation capture: `D:\CODEX\SynergyAcademy\tmp\design-qa\certificate-implementation-refined.png`
- Side-by-side comparison: `D:\CODEX\SynergyAcademy\tmp\design-qa\certificate-comparison-refined.png`
- Browser viewport: 1328 x 912 CSS pixels at device scale 1
- Source pixels: 3300 x 2550; normalized to 560 x 433 for comparison
- Implementation pixels: 560 x 433; certificate aspect ratio 11 x 8.5 landscape
- State: authenticated administrator, Certificate Template Studio, Design & Branding step, default Synergy Blue Completion template

## Full-view comparison evidence

The implementation preserves the visual guide's strongest brand cues: a white landscape field, substantial Synergy blue framing, a high-right Synergy Bahamas logo, bold uppercase credential heading, restrained navy/blue palette, and a blue lower rule. The source is a largely empty attendance template; the implementation intentionally uses the open field for live learner, course, skill, issue, signature, and verification data. The straight blue rail replaces the source's raster curved band so the default remains crisp at any browser or PDF size; administrators can upload an exact full-background design when needed.

## Focused-region comparison evidence

The certificate body and lower credential region were checked at the embedded 560 x 433 preview size. The final pass shows the learner and course hierarchy clearly, keeps the Synergy logo sharp, leaves the signature/date/verification row above the bottom band, and keeps the public-verification label and unique code legible. A focused region comparison was necessary because the first pass revealed lower-row crowding that was not obvious from the full admin screen.

## Required fidelity surfaces

- Fonts and typography: Montserrat remains the display face and Open Sans the supporting face. Container-relative sizing now scales with the certificate itself rather than the browser viewport. Heading, learner, course, metadata, and verification hierarchy are distinct at preview and PDF sizes.
- Spacing and layout rhythm: The content is centered in the source's open white field. The signature/date/verification row has reserved height and no longer collides with the bottom band.
- Colors and visual tokens: Synergy navy and blue match the application brand tokens and can be changed in the template editor. Contrast is sufficient on white and blue surfaces.
- Image quality and asset fidelity: The supplied Synergy Bahamas logo is used as a real raster asset. Uploaded background and alternate logo assets retain their source files through the certificate-assets bucket.
- Copy and content: Template wording is editable. The sample shows a realistic learner, course, skills, issue date, unique verification code, signature, and brand tagline.

## Comparison history

### Pass 1

- [P2] Signature and footer crowding at embedded preview size. Viewport-relative type sizes caused the certificate body to consume the lower credential row, placing signature text too close to the blue footer.
- Fix: converted certificate typography and icons to container-relative units, reduced internal vertical gaps, made the body shrink correctly, and reserved a fixed lower credential row.

### Pass 2

- Post-fix evidence: `certificate-comparison-refined.png` shows the signature, issue date, code, and public-verification label fully above the footer band.
- No actionable P0, P1, or P2 visual issues remain.

## Interaction and responsive checks

- Guided template wizard opens and advances from Basics to Design & Branding.
- Live certificate preview renders without browser console errors.
- Demo PDF generation completes in the browser.
- Public `/verify` page accepts and normalizes a code and presents a clear not-found state.
- Public verification was inspected at 390 x 844; the form, result surface, contact links, and branding remain within the viewport.
- The live database does not yet contain migration 015, so persisted template CRUD, automatic issuance, valid-code lookup, and email delivery require post-migration integration testing.

## Follow-up polish

- [P3] Exact curved certificate framing can be reproduced by uploading the user's full background artwork through the template editor when a fixed print-design match is preferred over the responsive default.

result: passed

---

# AI Business Essentials student workspace design QA

- Source visual truth: `D:\CODEX\AI Class\tmp\pdfs\individual_modules_v1_2\AI_Business_Essentials_Introduction_eLearning_Storyboard_v1.2-01.jpg`
- Portal baseline: `C:\Users\garre\.codex\visualizations\2026\08\18\01a01654-26a6-73f3-bc00-f53e084127bf\synergy-academy-dev.png`
- Implementation evidence: Codex in-app Browser tab 1 at `http://127.0.0.1:5174/dev/ai-business-essentials`, captured and inspected during this QA run
- Browser viewport: 1222 x 920 CSS pixels
- State: student preview, Introduction and Module 1 progression, plus Learning, Assessments, Activities, and Assignments

## Full-view comparison evidence

The combined comparison used the approved Introduction storyboard, the original Academy portal baseline, and the browser-rendered implementation. The implementation preserves the portal's established Synergy identity while bringing in the storyboard's navy, blue, white, and restrained gold language. It keeps the main course navigation and identity shell course-agnostic, then gives the enrolled course a clear four-area workspace. At the tested desktop viewport, the module outline and one-screen learning panel are visible together without horizontal overflow.

## Focused-region comparison evidence

The focused learning comparison covered Introduction screen 1, the card-based course-at-a-glance screen, and the final Introduction handoff. Content hierarchy matches the storyboard: small eyebrow, plain-language heading, short lead, structured points, and a single clear action. The final screen has no assessment link and presents `Complete and go to Module 1`. A full 16-screen interaction pass confirmed that Module 1 unlocks immediately after Introduction.

The course-area comparison covered locked module checks, the activity catalog, and homework/capstone assignments. Assessment cards communicate question count, pass mark, and lock reason. Activity cards communicate steps and self-check length. Assignment cards separate four homework items from the staged capstone work while keeping everything under Assignments.

## Required fidelity surfaces

- Typography: Montserrat/Open Sans hierarchy is retained with readable 6th-grade-level learner copy and no presentation-sized text blocks.
- Layout rhythm: one focused explainer screen at a time, a bounded module outline, generous white space, and consistent card padding.
- Colors and tokens: existing Synergy navy/blue tokens lead; pale blue surfaces and restrained warm callouts mirror the approved storyboard.
- Navigation: Learning, Assessments, Activities, and Assignments remain persistent and work inside the existing multi-course portal architecture.
- Progression: Introduction is a real module, Module 1 is locked until it is completed, later learning modules depend on the prior module check, and graded checkpoints remain locked until their required module.
- Copy: learner-facing delivery language uses `eLearning`; the capstone is housed in Assignments; Module 12 is course review and reference rather than a capstone lesson.

## Comparison history

### Pass 1

- [P1] At 1222 pixels wide, the preview used an `xl` split breakpoint, which stacked the full module list above the active learning screen and hid the core content below the fold.
- Fix: changed the course workspace split to the `lg` breakpoint, constrained the module outline to the available viewport height, and gave it independent scrolling.

### Pass 2

- Post-fix browser evidence shows the module outline and active screen together, the four course areas in one scan line, readable screen content, and the final action within the normal page flow.
- [P2] The assessment preview initially displayed only six module checks, so the graded quizzes, midterm, and final were not represented.
- Fix: included all 16 assessment entries and added explicit labels for module checks, graded quizzes, the midterm, and the final.
- No remaining actionable P0, P1, or P2 visual findings.

## Interaction, accessibility, and runtime checks

- Walked all 16 Introduction screens with Back/Next controls.
- Verified Introduction completion unlocks and opens Module 1 without an Introduction assessment.
- Verified locked module controls are disabled and expose clear accessible labels.
- Verified the four course-area controls are keyboard-addressable buttons with visible active states.
- Inspected the Learning, Assessments, Activities, and Assignments surfaces in the browser.
- Browser console warning/error check returned no entries.
- TypeScript, ESLint, course-content verification, and production build pass.
- Live database seeding and authenticated new-content verification remain pending until local administrator credentials are supplied and migration 017 is applied.

final result: blocked

### Live student workspace verification update, 4 September 2026

- Signed in through the Demo Student control and confirmed the named `Welcome, Demo.` start screen.
- Confirmed the multi-course library, dashboard course context, 15% progress consistency, course announcements, upcoming work, and private performance summary.
- Confirmed Introduction plus Modules 1-12 render as premium module cards. Each card shows learning progress and the latest assessment score; Introduction correctly shows `N/A` because it has no linked assessment.
- Confirmed the bounded learning player keeps the module rail, explainer screen, percentage, and navigation controls within one stable desktop frame.
- Confirmed the assessment player uses one question per screen, light unified chrome, live right/wrong feedback, explanations, review mode, and a persistent score rail.
- Confirmed module checks display unlimited attempts and all graded quizzes and exams display one attempt.
- Confirmed Assignments visually distinguish Homework from Capstone project work.
- Confirmed Discussion Board reactions persist and can be removed; reply controls and emoji shortcuts open within each post.
- Confirmed Messages defaults to Announcements and consolidates enrolled-course Q&A, private messages, and course updates. Q&A course choices are sourced only from active enrolments and database RLS provides the final cohort boundary.
- Confirmed Course Home shows the latest announcement first and includes an instructor tile with a keyboard-dismissable profile dialog.
- Confirmed Certificates displays `Digital Certificates Coming Soon` when no credential has been issued.
- Confirmed the private student textbook appears with a working Open control in the local demo. Migration 019 replaces the temporary demo signed-link fallback in deployed environments.
- Confirmed all eight course sections appear directly in the desktop tab bar. The compact More menu is reserved for narrower responsive layouts and renders above page content without clipping.
- Confirmed module checks now appear inside completed Learning cards and launch in the Learning context. The Assessments tab contains only graded checkpoints, the midterm, and the final exam.
- Confirmed the learning player has a screen-specific Notes modal with automatic saving. Local demo mode falls back to device storage until migration 021 is applied.
- Confirmed the Profile screen provides validated profile-photo upload, replacement, and removal controls. The shared avatar component carries saved photos through the account header, discussion feed, message feed, and instructor surfaces.
- Confirmed the dashboard learning-at-a-glance panel appears above the course chooser and uses a tinted visual band to separate live course context from the catalog.
- Confirmed Messages defaults to Announcements and places Announcements first in the tab order.
- TypeScript, ESLint, migration structure, curriculum verification, and production build pass after the final interface changes.

final result: passed for the local authenticated student experience; migrations 017-021 remain required before production release

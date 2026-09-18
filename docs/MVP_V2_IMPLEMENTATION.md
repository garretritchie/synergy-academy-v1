# MVP v2 — implementation and rollout record

18 September 2026. Implemented locally on `codex/mvp-v2`. **Not pushed, deployed or enabled in the hosted database.**

## Preserved v1

- Commit: `563287b2448bd175ed01a6a482f7f52a70bcdc65`.
- Branch: `codex/v1-preserved`.
- Annotated tag: `v1-preserved-2026-09-18`.
- Verified Git bundle: `private/version-backups/synergy-academy-v1.bundle` (local, ignored).
- The snapshot includes the existing role-view work and approved implementation plan. Private configuration and supplied content remain ignored rather than entering Git.

For a code rollback, create a separate checkout from the v1 tag. Do not hard-reset the working v2 branch. For a cohort delivery rollback, use **Return cohort to v1 delivery** in the studio and deploy the v1 UI if needed. Keep the additive v2 schema and academic records; do not reverse migrations by dropping tables. Record counts and a hosted database/storage backup are still required before deployment—the Git bundle is a source backup, not a database backup.

## Implemented scope

| Plan phase | Local result |
|---|---|
| 1: foundation | Simplified role navigation, compatible legacy routes, additive component/binding/progress model, opt-in cohort delivery. |
| 2: student and release | Dashboard, overview, modules, safe locked outline, manual/scheduled/relative release, required-component totals and preparation status. |
| 3: dedicated materials | Separate recap, video, audio and resource routes; recap page resume, media position, native controls/speed, independent completion, signed-resource access and media-link retry. |
| 4: activity evidence | Guided instructions, written response, self-checks, private uploads, draft/revise/submit flow, required-object validation, separate review queue and version history. |
| 5: assessments | Three beta question types, configurable attempts/pass mark/shuffle/reveal, saved answers, server grading, repeat-submit idempotency and saved-result review. |
| 6: live companion | Session bindings, preparation count, joining details, student attendance, instructor correction and bulk marking that preserves existing records. |
| 7: grades and operations | Shared weighted current-grade calculation, ungraded/returned statuses, zero-grade handling, cohort grid, failed-check/review/preparation dashboard, teaching profile and welcome link. |
| 8: beta content | Module 1 source package prepared offline. Remaining modules and actual live timetable were not supplied. |
| 9: acceptance | Local SQL and browser verification. Hosted role/storage and real-device acceptance remain a release gate. |

The module overview contains links and statuses only. Each component opens a dedicated destination. Primary student screens have no wide grade tables; the instructor grade grid can scroll horizontally.

### Completion rules

- Recap: final page plus explicit confirmation. Video/audio: explicit confirmation, with position saved separately. YouTube embeds support completion but do not report playback position.
- Resources: optional by default; an explicit review confirmation when configured as required.
- Activities: every bound activity submitted or graded; returned work becomes outstanding.
- Assessments: each bound assessment has a server-accepted attempt, meeting its passing rule when required.
- Live class: present, late or left-early counts as attended; excused or cancelled is waived. Missing/absent does not complete it. Attendance percentage excludes excused and cancelled sessions.
- Overall progress includes published required components in future modules. Preparation and Continue Module exclude the attendance component. Empty requirements display an explicit empty state.

New grade categories default to zero weight, so authoring cannot silently change historical weights. Existing configured categories continue to determine the current grade. A returned activity's prior grade stays stored but is excluded from the current grade until graded again.

## Module 1 provenance

Authoritative source: `B1-101_Module_01_AI_foundations_v4.4.pdf`. The supplied learning-journey deck's cover references eBook v4.3; keep the deck intact and use v4.4 for the recap/activity/check. PDF page references in the package refer to the supplied 30-page extract, not whole-book pagination.

Source data: `content/companion/module-01.mjs` contains 13 concise recap pages, the workshop-checklist activity and 10 derived review questions. This source is outside the frontend bundle, including its answer keys. The first three questions follow the eBook's knowledge check; the remaining questions extend checks of the supplied chapter. An instructor should review the bank, 70% passing threshold and two-attempt default before release. The draft check is ungraded by default.

Four original files are copied to ignored `private/course-content/module-01/`. The generated `private/course-content/module-01-manifest.json` records exact file lengths and SHA-256 hashes. No video/audio transcript or captions were supplied or invented. The actual video and audio loaded in the local browser fixture; this does not test hosted streaming or signing.

The v4.4 eBook describes 20/40/20/20 grading, while the legacy course has 10/40/20/30. The importer does not alter existing grade weights. Set a reviewed formula for the new cohort before beta. No live class date or meeting URL is fabricated.

### Offline preparation and controlled import

Run `node scripts/prepare-companion-module-one.mjs` to validate local assets and generate the manifest. It makes **no network calls** without `--apply`.

After deploying migrations to a staging database, use an empty staging course/cohort/module with no enrolled students. Provide `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `COMPANION_ADMIN_EMAIL` and `COMPANION_ADMIN_PASSWORD` as process environment variables. Run the script with `--apply --cohort <uuid> --module <uuid>`. It signs in as an administrator, validates course membership, uploads private files and creates draft component references. It does not enable v2, release modules or change grade weights. Review in the studio, bind the real session, publish components and explicitly enable/release the cohort.

Existing published components and recap reimports are rejected to protect history. Uploads before recap creation have stable object IDs; if a later step fails after recap creation, inspect the partial draft and finish it in the studio rather than automatically rerunning authoring. Import is a sequence of authenticated operations, not a single cross-storage/database transaction.

## Verification record

- TypeScript, ESLint and production build passed. The build retains the existing outdated Browserslist-data warning.
- `npm run verify:sessions` applies canonical migrations through 036 in isolated PGlite, then exercises legacy and v2 flows. Includes student isolation, instructor scope, locked reads/RPCs, release rules, completion independence, saved positions, actual-object evidence, multiple-select scoring, attempt limits, reveal settings, idempotency, zero grades, returns, bulk attendance and v1 delivery rollback. Auth/storage are stubs and extension migration 016 is excluded.
- `node scripts/verify-companion-browser.mjs` exercises an isolated local Edge browser with intercepted fixture API responses and a temporary loopback media server. Desktop/mobile/tablet screenshots are in ignored `tmp/companion-qa/`. Covers all seven screens, overview separation, recap persistence, assessment flow, locked state and instructor dashboard/studio. Does not use the user's browser profile or browsing history.
- `verify:path`, `verify:course`, `verify-submission-policy.mjs` and `verify-role-view.mjs` cover retained compatibility behavior.
- PDF text was extracted and the activity page/slide cover visually checked for source correspondence. This is not a full visual audit of every supplied PDF page.

### Finish review — ship

| Original finding | Final status |
|---|---|
| Component module identity and completion context | Resolved |
| Accessible progress name and 44px checklist links | Resolved |
| Plain companion canvas instead of decorative stripes | Resolved |
| Source reference below recap content | Resolved |
| Product typography documentation | Resolved |

The independent review reported no remaining material findings. `DESIGN.md` and its design sidecar were reconciled to the implemented extension. Source/header paths for the legacy delivery remain available, and course selection is remembered per account when moving between dashboard, grades and attendance.

## Hosted rollout gate

1. Reconcile the real migration ledger and capture database/storage backups and academic record counts. The repository contains historical duplicate `.sql.sql` files; do not execute both versions. Confirm migrations 001–031 already match the target, then apply only new canonical 032–036 in order.
2. Deploy the app against that migrated staging backend, import/review Module 1, set grade weights and real session details. Keep all student deliveries disabled until reviewed.
3. Exercise the complete flow with two ordinary students, an assigned instructor, an unassigned instructor and an administrator. Verify real private upload/signing policies, relock denial and signed-link expiry, assessment/session concurrency, grade corrections and profile visibility.
4. Check actual phone/tablet browsers, media seeking after five-minute signed-link expiry, large audio download/streaming, network/upload failure recovery and cross-device resume.
5. Obtain remaining course content and the real schedule, then complete the beta scenario and publish through the normal release workflow. Local passing checks do not establish hosted readiness.

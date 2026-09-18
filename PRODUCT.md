# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Synergy Bahamas administrators operate the academy, instructors deliver and assess cohort-based courses, and students learn through a mix of eLearning content and live classes. A person may hold more than one role and uses one account across role-specific workspaces.

## Product Purpose

Synergy Academy is the eLearning Platform for Synergy Bahamas. It manages the complete delivery of instructor-led courses: course setup, cohorts, enrolment, curriculum, live sessions, assignments, assessment, progress, communication, completion, and academic records.

## Positioning

The platform joins reusable eLearning curriculum with scheduled live cohort delivery and a durable student academic record in one role-aware system.

## Operating Context

Administrators prepare courses and cohorts before a delivery begins. Instructors manage sessions, attendance, assignments, grading, and cohort communication. Students complete released lessons, attend live sessions, submit work, follow their performance, participate in course discussions, and access completion records.

## Capabilities and Constraints

- Authentication and authorization use the existing Bolt Supabase project, with database RLS as the security boundary.
- One authenticated account may have administrator, instructor, and student roles simultaneously.
- Course content is reusable; cohorts own delivery dates, instructors, enrolments, sessions, release rules, and academic outcomes.
- Payments, CRM synchronization, and public course commerce are post-beta work and must not delay the first course.
- Production publishing is manual. Isolated local verification uses fixtures; hosted checks run separately against the configured backend.

## Brand Commitments

The product name is Synergy Academy by Synergy Bahamas. Use the supplied Synergy Bahamas logos, the established navy, blue, white, and warm-gold identity, the native sans-serif typography approved in the September refinement for both headings and supporting text. The experience should feel professional, clear, structured, and suitable for adult and continuing education.

## Evidence on Hand

- Synergy Bahamas brand guide and supplied full-color and white logo assets.
- A comprehensive Supabase schema and RLS migration set in `supabase/migrations`.
- The approved Course Delivery Companion v2 plan in `docs/MVP_V2_PLAN.md`, which supersedes the earlier broad LMS roadmap.
- Legacy curriculum remains in `src/content/ai-business-essentials.json`. The supplied Module 1 eBook v4.4 is authoritative for its new companion package; original private media stays outside Git.

## Product Principles

- One identity, multiple RLS-governed workspaces.
- Make the next useful action obvious for each role.
- Keep curriculum separate from cohort delivery and student outcomes.
- Treat progress, grades, attendance, and submissions as private academic records.
- Prefer complete, understandable workflows over decorative dashboard metrics.

## Accessibility & Inclusion

The web interface must be keyboard accessible, responsive from mobile through desktop, provide visible focus and error states, and maintain readable contrast and text sizing.

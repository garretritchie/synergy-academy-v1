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
- Production publishing is manual. Local development and verification run against the Bolt Supabase backend.

## Brand Commitments

The product name is Synergy Academy by Synergy Bahamas. Use the supplied Synergy Bahamas logos, the established navy, blue, white, and warm-gold identity, Montserrat for interface headings, and Open Sans for supporting text. The experience should feel professional, clear, structured, and suitable for adult and continuing education.

## Evidence on Hand

- Synergy Bahamas brand guide and supplied full-color and white logo assets.
- A comprehensive Supabase schema and RLS migration set in `supabase/migrations`.
- A detailed 23-sprint build plan supplied with this project.
- The authoritative AI Business Essentials learner package is present in `src/content/ai-business-essentials.json`, generated from the approved storyboard sources and verified against the 286-screen curriculum map.

## Product Principles

- One identity, multiple RLS-governed workspaces.
- Make the next useful action obvious for each role.
- Keep curriculum separate from cohort delivery and student outcomes.
- Treat progress, grades, attendance, and submissions as private academic records.
- Prefer complete, understandable workflows over decorative dashboard metrics.

## Accessibility & Inclusion

The web interface must be keyboard accessible, responsive from mobile through desktop, provide visible focus and error states, and maintain readable contrast and text sizing.

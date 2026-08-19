# Access, organizations, and future commerce

Course access is separate from the student role and from cohort membership.
A learner may receive access through any of these paths:

- an active cohort enrolment for instructor-led delivery;
- an individual seat for one course;
- an individual seat for the full platform;
- an organization seat for one course; or
- an organization seat for the full platform.

## Terms and seat caps

Migration 013 adds access offerings, dated contracts, and seat assignments.
An offering can cover one course or the entire platform and can represent a
one-off term or a recurring subscription. Contracts support 3, 6, and 12 month
terms, a start and end date, and an enforced seat cap.

Payment status is intentionally not inferred in the browser. A future commerce
integration should activate, suspend, renew, or cancel the access contract after
verifying the provider event on a trusted server. Course authorization continues
to come from `can_access_course`, not from client-side purchase state.

## Organization responsibilities

Each organization has a main point of contact. Administrators can also designate
additional seat managers. These users can:

- view contracts for their organization;
- see used and available seats;
- assign a seat to an existing active academy account; and
- revoke an assigned seat.

Organization contacts do not receive platform-administrator permissions. Seat
assignment and revocation run through security-definer functions that verify the
contact, contract dates, contract status, and cap before changing access.

For the current release, an employee creates an academy account before the
organization contact assigns the seat by email. Provider-backed email invitations
can be added later without changing the entitlement model.

## Product mapping

| Commercial offer | Access record |
| --- | --- |
| Individual single-course purchase | One-seat course contract assigned to purchaser |
| Individual platform membership | One-seat platform contract assigned to purchaser |
| Company course seats | Organization course contract with capped assignments |
| Company platform membership | Organization platform contract with capped assignments |
| Live instructor-led training | Cohort enrolment, optionally combined with a contract |

The same person may be both a company contact and a learner, or both an
instructor and a learner. Authentication stays role-neutral; authorization is
derived from roles, teaching assignments, cohort enrolments, organization
membership, and active access entitlements.

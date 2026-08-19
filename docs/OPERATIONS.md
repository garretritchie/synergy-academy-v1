# Synergy Academy beta operations

## Before using the first cohort

1. Sync the repository through GitHub/Bolt without the internal `Prompts/` folder.
2. Apply every file in `supabase/migrations` in timestamp order. Migration 012 is mandatory for private files, secure quizzes, messaging, notifications, audit trails, and completion evaluation. Migration 013 enables organizations, contracts, and capped seats.
3. In Supabase Authentication URL settings, add the local and production reset-password URLs documented in the root README.
4. Confirm the `course-assets` and `assignment-submissions` buckets exist and remain private.
5. Have each real user sign up, then activate their account and assign one or more roles in **Admin → Users & roles**.

## Configure a course

1. In **Categories**, create or activate the categories the course belongs to and set their display order.
2. In **Courses**, create the draft course, assign all applicable categories, add its cover/introduction URLs, choose delivery mode, and configure completion requirements.
3. In **Curriculum builder**, add modules, lessons, and blocks. Upload lesson images, videos, and downloads directly; use an external-link block only for intentionally hosted material. Use the arrow controls to order content, add meaningful image alt text, and keep modules and lessons in draft until reviewed.
4. In **Content release**, configure immediate, scheduled, cohort-relative, or previous-lesson release rules.
5. In **Course resources**, follow the guided workflow to describe, place, and upload the private file. Trusted external links are an explicit alternative. Scope a resource to a lesson when it must remain locked until that lesson releases.
6. Publish the reviewed modules, lessons, and course.

## Configure a cohort

1. In **Cohorts**, choose the course, add dates/capacity, and assign every instructor.
2. In **Enrolments**, add active student-role accounts to the cohort.
3. As an instructor, schedule live sessions, create assignments/quizzes, and publish the opening announcement. Upload each session recording directly after class; students receive an expiring private playback link.
4. Confirm the student sees only released lessons, their own records, and the correct live-session/assignment details.

## Configure organization access

1. Have the company’s main point of contact create an academy account.
2. In **Access & organizations**, follow the wizard to select the contact, choose one-course or platform access, set the 3, 6, or 12 month term, and set the seat cap.
3. The contact opens **Company seats** from the account menu.
4. Each employee creates an academy account, then the contact assigns a seat using the employee’s email address.
5. Confirm the seat counter never exceeds the contract cap and access ends when the contract is suspended, cancelled, or expires.

## During delivery

- Instructors take attendance from **Attendance**, review private submissions and written quiz answers in **Gradebook**, configure category weights, enter practical/manual grades, add staff-only enrolment notes in **Students**, and respond through announcements, Q&A, discussions, or private messages.
- Students work from the dashboard’s current-course status, then use the course navigation for lessons, live sessions, assignments, performance, and communication.
- Published academic events create in-app notifications after migration 012 is installed.
- Sensitive changes to attendance, grades, enrolments, certificates, and role assignments are recorded in `audit_log` for administrators.

## Complete a learner

1. Review the learner’s progress, submissions, quiz attempts, grades, and attendance.
2. In **Admin → Enrolments**, choose **Completed**.
3. The server evaluates the course completion rules. If a requirement is missing, the interface reports the relevant counts or threshold.
4. If eligible, the server stores completion/final-grade data and issues one certificate record.
5. The student opens **Certificates** and uses **Print / save PDF**. The QR code and printed verification URL resolve without a login.
6. If a certificate was issued in error, an administrator records a reason and revokes it from **Reporting**; revoked records remain visible and fail public verification as valid.

## Local acceptance checklist

### Student

- Sign in and confirm only student routes are available.
- Open a released lesson, mark it complete, and confirm progress changes.
- Confirm a locked lesson cannot be opened by changing the URL.
- Take a quiz, upload a private assignment, and view the resulting grade/feedback.
- Join a live-session link; review attendance, announcements, Q&A, discussions, messages, and certificate output.

### Instructor

- Confirm only assigned cohorts are visible.
- Create a session, assignment, quiz, and announcement.
- Record attendance from a narrow/mobile viewport.
- Open a private submission, grade it, review a written quiz response, enter a manual/practical grade, and confirm the student gradebook updates.
- Confirm an unrelated cohort cannot be queried through the client.

### Administrator

- Create/edit a category and draft course, assign multiple categories, and build/reorder curriculum.
- Create a cohort, assign multiple instructors, and enrol a student.
- Confirm reporting counts and completion evaluation.
- Review `audit_log` in Supabase after changing a role, attendance record, grade, or enrolment.

### Security

- Use two real test students for the final RLS pass. Student A must not retrieve Student B submissions, files, grades, attendance, messages, or notifications.
- An instructor must not retrieve records or file URLs for an unrelated cohort.
- A student must not retrieve `assessment_questions.correct_answer` or mutate submission grade/feedback fields.
- Signed private-file URLs should expire and direct storage paths should fail without authorization.

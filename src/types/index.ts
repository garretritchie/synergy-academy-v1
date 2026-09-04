export type UserRole = "administrator" | "instructor" | "student";

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: UserRole;
  description: string | null;
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  role?: Role;
}

export interface InstructorProfile {
  id: string;
  profile_id: string;
  title: string | null;
  specialization: string | null;
  qualifications: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  cover_image_url: string | null;
  cover_image_storage_path?: string | null;
  introduction_video_url: string | null;
  introduction_video_storage_path?: string | null;
  duration_weeks: number | null;
  difficulty_level: string | null;
  language: string;
  is_published: boolean;
  is_self_paced: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  categories?: CourseCategory[];
}

export interface Cohort {
  id: string;
  course_id: string;
  name: string;
  slug: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  enrolment_open: boolean;
  enrolment_start_date: string | null;
  enrolment_end_date: string | null;
  max_students: number | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  course?: Course;
}

export interface CohortInstructor {
  id: string;
  cohort_id: string;
  instructor_id: string;
  is_lead: boolean;
  created_at: string;
  instructor?: Profile;
}

export interface Enrolment {
  id: string;
  cohort_id: string;
  student_id: string;
  enrolled_at: string;
  status: string;
  completion_date: string | null;
  final_grade: number | null;
  metadata: Record<string, unknown>;
  cohort?: Cohort;
  course?: Course;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  display_order: number;
  is_published: boolean;
  metadata: Record<string, unknown>;
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  display_order: number;
  estimated_minutes: number | null;
  is_published: boolean;
  is_free_preview: boolean;
  metadata: Record<string, unknown>;
}

export interface LessonBlock {
  id: string;
  lesson_id: string;
  block_type: string;
  content: Record<string, unknown>;
  display_order: number;
}

export interface Resource {
  id: string;
  course_id: string | null;
  module_id: string | null;
  lesson_id: string | null;
  title: string;
  description: string | null;
  resource_type: string;
  url: string | null;
  file_size: number | null;
  is_downloadable: boolean;
  display_order: number;
  cohort_id: string | null;
  release_mode: "immediate" | "scheduled" | "checkpoint";
  release_at: string | null;
  release_checkpoint_type: "lesson" | "assessment" | "activity" | null;
  release_checkpoint_id: string | null;
  checkpoint_requires_pass: boolean;
  show_before_release: boolean;
}

export interface ContentReleaseRule {
  id: string;
  cohort_id: string;
  module_id: string | null;
  lesson_id: string | null;
  release_type: string;
  release_date: string | null;
  days_offset: number | null;
}

export interface LiveSession {
  id: string;
  cohort_id: string;
  title: string;
  description: string | null;
  session_type: string;
  scheduled_start: string;
  scheduled_end: string;
  instructor_id: string | null;
  meeting_platform: string;
  meeting_url: string | null;
  meeting_id: string | null;
  meeting_password: string | null;
  recording_url: string | null;
  recording_storage_path: string | null;
  preparation_notes: string | null;
  is_cancelled: boolean;
  metadata: Record<string, unknown>;
  instructor?: Profile;
}

export interface AttendanceRecord {
  id: string;
  live_session_id: string;
  student_id: string;
  enrolment_id: string;
  status: string;
  arrived_at: string | null;
  left_at: string | null;
  notes: string | null;
  recorded_by: string | null;
}

export interface Assignment {
  id: string;
  cohort_id: string | null;
  module_id: string | null;
  lesson_id: string | null;
  title: string;
  description: string | null;
  assignment_type: string;
  max_points: number;
  weight: number;
  due_date: string | null;
  allow_late_submission: boolean;
  late_penalty_percent: number | null;
  late_submission_deadline: string | null;
  allow_file_upload: boolean;
  allowed_file_types: string[] | null;
  max_file_size_mb: number | null;
  max_attempts: number;
  is_published: boolean;
}

export interface Submission {
  id: string;
  assignment_id: string;
  enrolment_id: string;
  student_id: string;
  content: string | null;
  status: string;
  submitted_at: string | null;
  is_late: boolean;
  late_penalty_applied: number | null;
  grade: number | null;
  max_grade: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
  attempt_count: number;
}

export interface SubmissionVersion {
  id: string;
  submission_id: string;
  assignment_id: string;
  enrolment_id: string;
  student_id: string;
  attempt_number: number;
  content: string | null;
  submitted_at: string;
  is_late: boolean;
}

export interface Assessment {
  id: string;
  cohort_id: string;
  module_id: string | null;
  lesson_id: string | null;
  title: string;
  description: string | null;
  assessment_type: string;
  instructions: string | null;
  time_limit_minutes: number | null;
  max_attempts: number;
  passing_score: number | null;
  is_published: boolean;
}

export interface GradeCategory {
  id: string;
  cohort_id: string;
  name: string;
  description: string | null;
  weight: number;
  drop_lowest: number;
  display_order: number;
}

export interface GradeItem {
  id: string;
  grade_category_id: string;
  assignment_id: string | null;
  assessment_id: string | null;
  name: string;
  description: string | null;
  max_points: number;
  due_date: string | null;
  display_order: number;
}

export interface Grade {
  id: string;
  grade_item_id: string;
  enrolment_id: string;
  student_id: string;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  letter_grade: string | null;
  feedback: string | null;
  is_excused: boolean;
  graded_by: string | null;
  graded_at: string | null;
  override_reason: string | null;
}

export interface ProgressRecord {
  id: string;
  enrolment_id: string;
  student_id: string;
  lesson_id: string;
  cohort_id: string;
  status: string;
  progress_percent: number;
  time_spent_seconds: number;
  last_accessed_at: string | null;
  completed_at: string | null;
}

export interface Announcement {
  id: string;
  cohort_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_published: boolean;
  author_id: string | null;
  published_at: string | null;
  created_at: string;
  author?: Profile;
}

export interface Discussion {
  id: string;
  cohort_id: string;
  module_id: string | null;
  lesson_id: string | null;
  title: string;
  body: string | null;
  is_pinned: boolean;
  is_locked: boolean;
  author_id: string | null;
  parent_id: string | null;
  is_question: boolean;
  is_resolved: boolean;
  created_at: string;
  author?: Profile;
}

export interface DiscussionPost {
  id: string;
  discussion_id: string;
  author_id: string | null;
  body: string;
  is_instructor_reply: boolean;
  is_accepted_answer: boolean;
  created_at: string;
  author?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link_url: string | null;
  related_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender?: Profile;
  recipient?: Profile;
}

export interface Certificate {
  id: string;
  enrolment_id: string;
  student_id: string;
  cohort_id: string;
  course_id: string;
  certificate_number: string;
  title: string;
  issued_date: string;
  final_grade: number | null;
  letter_grade: string | null;
  issued_by: string | null;
  status: "issued" | "revoked";
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  template_id?: string | null;
  template_snapshot?: Record<string, unknown>;
  skills_snapshot?: string[];
  student_name_snapshot?: string | null;
  course_title_snapshot?: string | null;
}

export interface ExternalSystemLink {
  id: string;
  system_name: string;
  entity_type: string;
  local_entity_id: string;
  external_entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

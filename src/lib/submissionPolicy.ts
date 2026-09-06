import type { Submission } from '@/types';

/** A zero score is still a grade. Never rely only on the status label. */
export function isSubmissionGraded(submission?: Pick<Submission, 'status' | 'grade' | 'graded_at'> | null) {
  return Boolean(submission && (submission.status === 'graded' || submission.grade != null || submission.graded_at != null));
}

export function submissionSaveError(message: string) {
  return message.includes('Maximum submission attempts reached')
    ? 'The database is still using the older submission limit. Your work remains on this page. Ask your administrator to apply the pending submission migrations through 028, then try again.'
    : message;
}

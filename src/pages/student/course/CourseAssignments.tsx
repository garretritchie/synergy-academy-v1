import { ClipboardList } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CourseAssignments() {
  return (
    <CourseLayout>
      <PageHeader title="Assignments" subtitle="Your homework and projects" />
      <div className="card mt-6">
        <EmptyState
          icon={<ClipboardList size={32} />}
          title="No assignments yet"
          description="Assignments will appear here when published by your instructor. You'll be able to submit work, upload files, and view your grades and feedback."
        />
      </div>
    </CourseLayout>
  );
}

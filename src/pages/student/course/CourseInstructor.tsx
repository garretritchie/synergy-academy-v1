import { GraduationCap } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CourseInstructor() {
  return (
    <CourseLayout>
      <PageHeader title="Instructor" subtitle="Your course instructors" />
      <div className="card mt-6">
        <EmptyState
          icon={<GraduationCap size={32} />}
          title="No instructors assigned"
          description="Instructors will appear here once assigned to this cohort."
        />
      </div>
    </CourseLayout>
  );
}

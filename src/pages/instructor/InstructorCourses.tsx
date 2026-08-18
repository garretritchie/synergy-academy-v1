import { BookOpen } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function InstructorCourses() {
  return (
    <AppLayout>
      <PageHeader title="My Courses" subtitle="Cohorts you're teaching" />
      <div className="card mt-6">
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No cohorts assigned"
          description="Your assigned cohorts will appear here."
        />
      </div>
    </AppLayout>
  );
}

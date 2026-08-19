import { BookOpen } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function StudentCourses() {
  return (
    <AppLayout>
      <PageHeader title="My Courses" subtitle="Courses you're enrolled in" />
      <div className="card mt-6">
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No courses yet"
          description="You haven't been enrolled in any courses. Your courses will appear here once an administrator assigns you to a cohort."
        />
      </div>
    </AppLayout>
  );
}

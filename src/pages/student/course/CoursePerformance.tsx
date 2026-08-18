import { BarChart3 } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CoursePerformance() {
  return (
    <CourseLayout>
      <PageHeader title="Performance" subtitle="Your grades, attendance, and progress" />
      <div className="card mt-6">
        <EmptyState
          icon={<BarChart3 size={32} />}
          title="No performance data yet"
          description="Your grades, attendance records, and course progress will appear here once assignments are graded and live sessions are held."
        />
      </div>
    </CourseLayout>
  );
}

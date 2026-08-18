import { Video } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CourseLive() {
  return (
    <CourseLayout>
      <PageHeader title="Live Sessions" subtitle="Scheduled and recorded live classes" />
      <div className="card mt-6">
        <EmptyState
          icon={<Video size={32} />}
          title="No live sessions"
          description="Live sessions will appear here when scheduled by your instructor. Each session includes the meeting link, preparation notes, and related lessons."
        />
      </div>
    </CourseLayout>
  );
}

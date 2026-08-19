import { Megaphone } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CourseAnnouncements() {
  return (
    <CourseLayout>
      <PageHeader title="Announcements" subtitle="Important updates from your instructor" />
      <div className="card mt-6">
        <EmptyState
          icon={<Megaphone size={32} />}
          title="No announcements"
          description="Course announcements will appear here when posted by your instructor."
        />
      </div>
    </CourseLayout>
  );
}

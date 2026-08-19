import { MessageSquare } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CourseDiscussions() {
  return (
    <CourseLayout>
      <PageHeader title="Discussions" subtitle="Course discussion forum" />
      <div className="card mt-6">
        <EmptyState
          icon={<MessageSquare size={32} />}
          title="No discussions yet"
          description="Start a discussion to connect with your classmates and instructor."
        />
      </div>
    </CourseLayout>
  );
}

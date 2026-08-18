import { BookOpen } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CourseLearn() {
  return (
    <CourseLayout>
      <PageHeader title="Learn" subtitle="Course curriculum and lessons" />
      <div className="card mt-6">
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No lessons yet"
          description="Lessons will appear here once the instructor publishes the curriculum. Each lesson may include rich text, images, video, downloads, knowledge checks, and assignments."
        />
      </div>
    </CourseLayout>
  );
}

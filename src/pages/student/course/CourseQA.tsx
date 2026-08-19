import { HelpCircle } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CourseQA() {
  return (
    <CourseLayout>
      <PageHeader title="Q&A" subtitle="Ask questions and get answers from your instructor" />
      <div className="card mt-6">
        <EmptyState
          icon={<HelpCircle size={32} />}
          title="No questions yet"
          description="Don't hesitate to ask — your questions help everyone learn."
        />
      </div>
    </CourseLayout>
  );
}

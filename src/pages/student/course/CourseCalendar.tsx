import { CalendarDays } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CourseCalendar() {
  return (
    <CourseLayout>
      <PageHeader title="Calendar" subtitle="Upcoming sessions and assignment deadlines" />
      <div className="card mt-6">
        <EmptyState
          icon={<CalendarDays size={32} />}
          title="Nothing scheduled"
          description="Live sessions and assignment due dates will appear on this calendar."
        />
      </div>
    </CourseLayout>
  );
}

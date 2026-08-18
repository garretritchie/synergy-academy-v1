import { useParams } from 'react-router-dom';
import { BookOpen, TrendingUp, ClipboardList, Video, Megaphone, CheckCircle2, Clock } from 'lucide-react';
import { CourseLayout } from './CourseLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function CourseHome() {
  return (
    <CourseLayout>
      <PageHeader title="Course Home" subtitle="Your overview for this course" />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Progress', icon: TrendingUp, hint: 'Lesson completion' },
          { label: 'Next Session', icon: Video, hint: 'Upcoming live class' },
          { label: 'Assignments Due', icon: ClipboardList, hint: 'Pending work' },
          { label: 'Current Grade', icon: CheckCircle2, hint: 'Overall standing' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-bold text-ink-300">—</p>
                  <p className="mt-1 text-xs text-ink-400">{card.hint}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-400">
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock size={18} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-ink-900">Course Progress</h3>
          </div>
          <EmptyState icon={<TrendingUp size={28} />} title="No lessons yet" description="Your progress will appear here once lessons are published." />
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Megaphone size={18} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-ink-900">Latest Announcement</h3>
          </div>
          <EmptyState icon={<Megaphone size={28} />} title="No announcements" description="Announcements will appear here." />
        </div>
      </div>
    </CourseLayout>
  );
}

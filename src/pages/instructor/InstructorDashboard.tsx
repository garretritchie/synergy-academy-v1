import { Video, ClipboardList, Users, BarChart3 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function InstructorDashboard() {
  return (
    <AppLayout>
      <PageHeader title="Dashboard" subtitle="Your teaching overview" />

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Active Cohorts', icon: Users, hint: 'Cohorts you teach' },
          { label: 'Upcoming Sessions', icon: Video, hint: 'Scheduled live classes' },
          { label: 'Assignments', icon: ClipboardList, hint: 'To review or grade' },
          { label: 'Total Students', icon: BarChart3, hint: 'Across all cohorts' },
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
            <Users size={18} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-ink-900">My Cohorts</h3>
          </div>
          <EmptyState icon={<Users size={28} />} title="No cohorts assigned" description="Cohorts will appear here when you're assigned as an instructor." />
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Video size={18} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-ink-900">Upcoming Sessions</h3>
          </div>
          <EmptyState icon={<Video size={28} />} title="No upcoming sessions" description="Schedule live sessions for your cohorts." />
        </div>
      </div>
    </AppLayout>
  );
}

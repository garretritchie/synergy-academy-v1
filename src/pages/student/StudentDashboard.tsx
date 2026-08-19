import { Link } from 'react-router-dom';
import { BookOpen, TrendingUp, ClipboardList, Video, Megaphone, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function StudentDashboard() {
  const { profile } = useAuth();
  const firstName = profile?.first_name || 'there';

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title={`Welcome back, ${firstName}`} subtitle="What should I work on next?" />

        {/* Continue Learning — placeholder */}
        <div className="card-elevated overflow-hidden">
          <div className="border-b border-ink-200/60 bg-gradient-to-r from-brand-50 to-transparent px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen size={18} className="text-brand-600" />
              <h2 className="text-base font-semibold text-ink-900">Continue Learning</h2>
            </div>
          </div>
          <div className="p-5">
            <EmptyState
              icon={<BookOpen size={32} />}
              title="No courses yet"
              description="Once you're enrolled in a cohort, your courses will appear here with a quick link to resume where you left off."
            />
          </div>
        </div>

        {/* Reserved dashboard areas — placeholder cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Current Progress', icon: TrendingUp, hint: 'Track lesson completion' },
            { label: 'Current Grade', icon: CheckCircle2, hint: 'Your overall standing' },
            { label: 'Attendance', icon: Clock, hint: 'Live session attendance' },
            { label: 'Active Courses', icon: BookOpen, hint: 'Enrolled cohorts' },
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

        {/* Next live class & upcoming assignment — placeholders */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Video size={18} className="text-brand-600" />
              <h3 className="text-sm font-semibold text-ink-900">Next Live Class</h3>
            </div>
            <EmptyState icon={<Video size={28} />} title="No upcoming classes" description="Live sessions will appear here when scheduled." />
          </div>

          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList size={18} className="text-warning-600" />
              <h3 className="text-sm font-semibold text-ink-900">Upcoming Assignment</h3>
            </div>
            <EmptyState icon={<ClipboardList size={28} />} title="No upcoming assignments" description="Assignments will appear here when published." />
          </div>
        </div>

        {/* On-track status & announcements — placeholders */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp size={18} className="text-success-600" />
              <h3 className="text-sm font-semibold text-ink-900">On-Track Status</h3>
            </div>
            <EmptyState icon={<CheckCircle2 size={28} />} title="Not available yet" description="Your on-track status will appear here once you're enrolled." />
          </div>

          <div className="card p-5 lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <Megaphone size={18} className="text-brand-600" />
              <h3 className="text-sm font-semibold text-ink-900">Latest Announcement</h3>
            </div>
            <EmptyState icon={<Megaphone size={28} />} title="No announcements yet" description="Course announcements will appear here." />
          </div>
        </div>

        {/* Link to My Courses */}
        <div className="card p-5">
          <Link to="/student/courses" className="flex items-center justify-between transition-colors hover:bg-ink-50 rounded-lg p-2 -m-2">
            <div className="flex items-center gap-3">
              <BookOpen size={20} className="text-brand-600" />
              <span className="text-sm font-medium text-ink-900">Browse your enrolled courses</span>
            </div>
            <ArrowRight size={18} className="text-ink-400" />
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}

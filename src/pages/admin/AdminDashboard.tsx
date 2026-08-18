import { Link } from 'react-router-dom';
import { BookOpen, Users, Layers, ScrollText, FolderTree, ArrowRight, TrendingUp } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';

export function AdminDashboard() {
  const quickLinks = [
    { label: 'Courses', path: '/admin/courses', icon: BookOpen, desc: 'Create and manage courses' },
    { label: 'Categories', path: '/admin/categories', icon: FolderTree, desc: 'Organize courses into categories' },
    { label: 'Cohorts', path: '/admin/cohorts', icon: Layers, desc: 'Schedule course deliveries' },
    { label: 'Enrolments', path: '/admin/enrolments', icon: ScrollText, desc: 'Enrol students into cohorts' },
    { label: 'Users', path: '/admin/users', icon: Users, desc: 'Manage user accounts and roles' },
  ];

  return (
    <AppLayout>
      <PageHeader title="Dashboard" subtitle="Synergy Academy administration" />

      <div className="mt-6 card p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={18} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-ink-900">Getting Started</h3>
        </div>
        <EmptyState
          title="Welcome to Synergy Academy"
          description="Start by creating categories, then courses, then cohorts. Assign instructors to cohorts and enrol students to begin. The first beta course will be AI Business Essentials."
        />
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-ink-900">Quick Access</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.path} to={link.path} className="card-elevated group flex items-center gap-4 p-4 transition-all hover:shadow-elevated">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon size={22} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink-900 group-hover:text-brand-600">{link.label}</p>
                  <p className="text-xs text-ink-500">{link.desc}</p>
                </div>
                <ArrowRight size={18} className="text-ink-400 group-hover:text-brand-600" />
              </Link>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}

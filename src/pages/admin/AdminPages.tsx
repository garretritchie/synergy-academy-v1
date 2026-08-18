import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/Spinner';
import { Layers, ScrollText, Users, GraduationCap, Megaphone, BarChart3, Settings } from 'lucide-react';

export function AdminCohorts() {
  return (
    <AppLayout>
      <PageHeader title="Cohorts" subtitle="Manage course cohorts" />
      <div className="card mt-6">
        <EmptyState icon={<Layers size={32} />} title="No cohorts yet" description="Create cohorts to schedule course deliveries with their own students, instructors, and dates." />
      </div>
    </AppLayout>
  );
}

export function AdminEnrolments() {
  return (
    <AppLayout>
      <PageHeader title="Enrolments" subtitle="Manage student enrolments" />
      <div className="card mt-6">
        <EmptyState icon={<ScrollText size={32} />} title="No enrolments yet" description="Enrol students into cohorts to give them access to course content." />
      </div>
    </AppLayout>
  );
}

export function AdminUsers() {
  return (
    <AppLayout>
      <PageHeader title="Users" subtitle="Manage user accounts and roles" />
      <div className="card mt-6">
        <EmptyState icon={<Users size={32} />} title="No users yet" description="User accounts and role assignments will appear here." />
      </div>
    </AppLayout>
  );
}

export function AdminAcademic() {
  return (
    <AppLayout>
      <PageHeader title="Academic Management" subtitle="Manage assessments, grade categories, and curriculum" />
      <div className="card mt-6">
        <EmptyState icon={<GraduationCap size={32} />} title="Academic management" description="Configure assessments, grading scales, and curriculum structure here." />
      </div>
    </AppLayout>
  );
}

export function AdminCommunications() {
  return (
    <AppLayout>
      <PageHeader title="Communications" subtitle="Platform-wide announcements and messaging" />
      <div className="card mt-6">
        <EmptyState icon={<Megaphone size={32} />} title="No communications" description="Send platform-wide announcements and manage messaging here." />
      </div>
    </AppLayout>
  );
}

export function AdminReporting() {
  return (
    <AppLayout>
      <PageHeader title="Reporting" subtitle="Platform analytics and reports" />
      <div className="card mt-6">
        <EmptyState icon={<BarChart3 size={32} />} title="No reports yet" description="Platform analytics, enrolment reports, and performance metrics will appear here." />
      </div>
    </AppLayout>
  );
}

export function AdminSettings() {
  return (
    <AppLayout>
      <PageHeader title="Settings" subtitle="Platform configuration" />
      <div className="card mt-6">
        <EmptyState icon={<Settings size={32} />} title="Settings" description="Configure platform-wide settings, branding, and integrations here." />
      </div>
    </AppLayout>
  );
}

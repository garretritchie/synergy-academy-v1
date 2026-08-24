import { BookOpen, CalendarDays, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { useInstructorCohorts } from "@/hooks/useInstructorCohorts";
import { formatDate } from "@/lib/format";

export function InstructorCourses() {
  const { cohorts, loading, error } = useInstructorCohorts();
  return (
    <AppLayout>
      <PageHeader
        title="My cohorts"
        subtitle="The scheduled course deliveries assigned to you."
      />
      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : cohorts.length === 0 ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState
              icon={<BookOpen size={30} />}
              title="No cohorts assigned"
              description="An administrator must assign you to a cohort before teaching tools become available."
            />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {cohorts.map((cohort) => (
              <article
                key={cohort.id}
                className="rounded-xl bg-white p-5 shadow-soft"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <BookOpen size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-ink-900">
                        {cohort.course.title}
                      </h2>
                      <span
                        className={
                          cohort.is_active ? "badge-success" : "badge-neutral"
                        }
                      >
                        {cohort.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-600">{cohort.name}</p>
                    <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays size={14} />
                        {formatDate(cohort.start_date)} -
                        {formatDate(cohort.end_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        Capacity {cohort.max_students ?? "not set"}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/* Cohort IDs are serialized in effect dependencies so live relationship changes reload the dashboard. */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Users,
  Video,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { useInstructorCohorts } from "@/hooks/useInstructorCohorts";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import type { LiveSession } from "@/types";

export function InstructorDashboard() {
  const {
    cohorts,
    loading: cohortLoading,
    error: cohortError,
  } = useInstructorCohorts();
  const [stats, setStats] = useState({
    students: 0,
    sessions: 0,
    assignments: 0,
  });
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const ids = cohorts.map((cohort) => cohort.id);
  useEffect(() => {
    if (cohortLoading) return;
    if (!ids.length) {
      setLoading(false);
      return;
    }
    void (async () => {
      const now = new Date().toISOString();
      const [enrolmentResult, sessionResult, assignmentResult] =
        await Promise.all([
          supabase
            .from("enrolments")
            .select("*", { count: "exact", head: true })
            .in("cohort_id", ids)
            .eq("status", "active"),
          supabase
            .from("live_sessions")
            .select("*")
            .in("cohort_id", ids)
            .gte("scheduled_start", now)
            .eq("is_cancelled", false)
            .order("scheduled_start")
            .limit(5),
          supabase
            .from("assignments")
            .select("*", { count: "exact", head: true })
            .in("cohort_id", ids),
        ]);
      setStats({
        students: enrolmentResult.count ?? 0,
        sessions: sessionResult.data?.length ?? 0,
        assignments: assignmentResult.count ?? 0,
      });
      setSessions((sessionResult.data ?? []) as LiveSession[]);
      setLoading(false);
    })();
  }, [cohortLoading, ids.join(",")]);
  const cards = [
    {
      label: "Active cohorts",
      value: cohorts.filter((item) => item.is_active).length,
      icon: Users,
    },
    { label: "Upcoming sessions", value: stats.sessions, icon: Video },
    { label: "Assignments", value: stats.assignments, icon: ClipboardList },
    { label: "Active students", value: stats.students, icon: BarChart3 },
  ];
  return (
    <AppLayout>
      <PageHeader
        title="Teaching dashboard"
        subtitle="Plan delivery, follow your students, and close the loop on assessment."
      />
      <div className="mt-6 space-y-5">
        {cohortError && <Alert>{cohortError}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl bg-white p-5 shadow-soft"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-ink-500">{card.label}</p>
                    <card.icon size={18} className="text-brand-600" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-ink-900">
                    {card.value}
                  </p>
                </div>
              ))}
            </div>
            <section className="rounded-xl bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-ink-900">
                  Next live sessions
                </h2>
                <Link
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-700"
                  to="/instructor/live-sessions"
                >
                  Manage <ArrowRight size={15} />
                </Link>
              </div>
              {sessions.length === 0 ? (
                <p className="mt-5 text-sm text-ink-500">
                  No upcoming sessions are scheduled.
                </p>
              ) : (
                <div className="mt-3 divide-y divide-ink-100">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-3 py-3"
                    >
                      <Video size={17} className="text-brand-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-900">
                          {session.title}
                        </p>
                        <p className="text-xs text-ink-500">
                          {formatDateTime(session.scheduled_start)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Users,
  Layers,
  ScrollText,
  FolderTree,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase";

export function AdminDashboard() {
  const [counts, setCounts] = useState({
    courses: 0,
    cohorts: 0,
    enrolments: 0,
    submissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const tables = ["courses", "cohorts", "enrolments", "submissions"];
      const results = await Promise.all(
        tables.map((table) =>
          supabase.from(table).select("*", { count: "exact", head: true }),
        ),
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) setError(failed.error.message);
      else
        setCounts({
          courses: results[0].count ?? 0,
          cohorts: results[1].count ?? 0,
          enrolments: results[2].count ?? 0,
          submissions: results[3].count ?? 0,
        });
      setLoading(false);
    })();
  }, []);
  const quickLinks = [
    {
      label: "Courses",
      path: "/admin/courses",
      icon: BookOpen,
      desc: "Create and manage courses",
    },
    {
      label: "Categories",
      path: "/admin/categories",
      icon: FolderTree,
      desc: "Organize courses into categories",
    },
    {
      label: "Cohorts",
      path: "/admin/cohorts",
      icon: Layers,
      desc: "Schedule course deliveries",
    },
    {
      label: "Enrolments",
      path: "/admin/enrolments",
      icon: ScrollText,
      desc: "Enrol students into cohorts",
    },
    {
      label: "Users",
      path: "/admin/users",
      icon: Users,
      desc: "Manage user accounts and roles",
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Academy overview"
        subtitle="Current operational totals from the connected academy database."
      />

      <div className="mt-6">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton rows={2} />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Courses"
              value={counts.courses}
              icon={<BookOpen size={19} />}
              hint="All course records"
            />
            <StatCard
              label="Cohorts"
              value={counts.cohorts}
              icon={<Layers size={19} />}
              hint="All scheduled cohorts"
            />
            <StatCard
              label="Enrolments"
              value={counts.enrolments}
              icon={<ScrollText size={19} />}
              accent="success"
              hint="All enrolment records"
            />
            <StatCard
              label="Submissions"
              value={counts.submissions}
              icon={<TrendingUp size={19} />}
              accent="warning"
              hint="All assignment submissions"
            />
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
        <section className="page-section p-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={17} className="text-brand-700" />
            <h2 className="font-display text-sm font-semibold text-ink-950">
              Launch workflow
            </h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-500">
            Build the academic structure in this order before enrolling learners.
          </p>
          <ol className="mt-5 space-y-3">
            {quickLinks.slice(0, 4).map((link, index) => (
              <li key={link.path}>
                <Link to={link.path} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-brand-50">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 group-hover:bg-brand-600 group-hover:text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-ink-900">{link.label}</span>
                    <span className="block text-xs text-ink-500">{link.desc}</span>
                  </span>
                  <ArrowRight size={15} className="text-ink-300 group-hover:text-brand-700" />
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="page-section p-5">
          <h2 className="font-display text-sm font-semibold text-ink-950">
            Administration
          </h2>
          <p className="mt-1 text-xs leading-5 text-ink-500">
            Open the most common management areas.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className="group flex items-center gap-3 rounded-lg border border-ink-100 bg-ink-50/60 p-3 transition hover:border-brand-200 hover:bg-brand-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm">
                  <Icon size={17} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-ink-900 group-hover:text-brand-700">
                    {link.label}
                  </p>
                  <p className="text-xs text-ink-500">{link.desc}</p>
                </div>
                <ArrowRight
                  size={15}
                  className="text-ink-400 group-hover:text-brand-600"
                />
              </Link>
            );
          })}
          </div>
        </section>
        </div>
    </AppLayout>
  );
}

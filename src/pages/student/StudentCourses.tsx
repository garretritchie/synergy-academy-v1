import { CourseProgress } from "@/components/ui/CourseProgress";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Library,
  Search,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { formatDate } from "@/lib/format";
import type { Cohort, Course, Enrolment } from "@/types";

const PAGE_SIZE = 12;

type CourseRow = Enrolment & {
  cohort: Cohort & { course: Course };
  progress_records: Array<{ progress_percent: number; status: string }>;
};

type LibraryTab = "mine" | "catalog";
type CourseSort = "recent" | "title-asc" | "title-desc";

export function StudentCourses() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<LibraryTab>("mine");
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [catalog, setCatalog] = useState<Course[]>([]);
  const [releasedCounts, setReleasedCounts] = useState<Record<string, number>>(
    {},
  );
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<CourseSort>("recent");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [error, setError] = useState("");
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("enrolments")
        .select(
          "*,cohort:cohorts(*,course:courses(*)),progress_records(progress_percent,status)",
        )
        .eq("student_id", user.id)
        .order("enrolled_at", { ascending: false });
      if (queryError) setError(queryError.message);
      else setRows((data ?? []) as unknown as CourseRow[]);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (activeTab !== "catalog" || catalogLoaded) return;
    setCatalogLoading(true);
    void supabase
      .from("courses")
      .select("*")
      .eq("is_published", true)
      .order("title")
      .then(({ data, error: queryError }) => {
        if (queryError) setCatalogError(queryError.message);
        else setCatalog((data ?? []) as Course[]);
        setCatalogLoaded(true);
        setCatalogLoading(false);
      });
  }, [activeTab, catalogLoaded]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRows = useMemo(() => {
    const matches = rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        row.cohort.course.title.toLocaleLowerCase().includes(normalizedQuery) ||
        row.cohort.name.toLocaleLowerCase().includes(normalizedQuery);
      return (
        matchesQuery && (statusFilter === "all" || row.status === statusFilter)
      );
    });
    return [...matches].sort((left, right) => {
      if (sort === "title-asc")
        return left.cohort.course.title.localeCompare(
          right.cohort.course.title,
        );
      if (sort === "title-desc")
        return right.cohort.course.title.localeCompare(
          left.cohort.course.title,
        );
      return (
        new Date(right.enrolled_at).getTime() -
        new Date(left.enrolled_at).getTime()
      );
    });
  }, [normalizedQuery, rows, sort, statusFilter]);

  const filteredCatalog = useMemo(() => {
    const matches = catalog.filter(
      (course) =>
        !normalizedQuery ||
        course.title.toLocaleLowerCase().includes(normalizedQuery) ||
        course.short_description
          ?.toLocaleLowerCase()
          .includes(normalizedQuery) ||
        course.description?.toLocaleLowerCase().includes(normalizedQuery),
    );
    return [...matches].sort((left, right) =>
      sort === "title-desc"
        ? right.title.localeCompare(left.title)
        : left.title.localeCompare(right.title),
    );
  }, [catalog, normalizedQuery, sort]);

  const activeResults = activeTab === "mine" ? filteredRows : filteredCatalog;
  const totalPages = Math.max(1, Math.ceil(activeResults.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleRows = useMemo(
    () => filteredRows.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredRows, pageStart],
  );
  const visibleCatalog = useMemo(
    () => filteredCatalog.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredCatalog, pageStart],
  );

  useEffect(() => {
    if (activeTab !== "mine" || !visibleRows.length) return;
    let current = true;
    void Promise.all(
      visibleRows.map((row) =>
        supabase
          .from("lessons")
          .select("id,module:modules!inner(course_id)")
          .eq("module.course_id", row.cohort.course_id)
          .eq("is_published", true),
      ),
    ).then((releases) => {
      if (!current) return;
      setReleasedCounts((existing) => ({
        ...existing,
        ...Object.fromEntries(
          visibleRows.map((row, index) => [
            row.cohort_id,
            Array.isArray(releases[index].data)
              ? releases[index].data.length
              : 0,
          ]),
        ),
      }));
    });
    return () => {
      current = false;
    };
  }, [activeTab, visibleRows]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, normalizedQuery, sort, statusFilter]);

  const enrolledByCourse = useMemo(
    () => new Map(rows.map((row) => [row.cohort.course_id, row])),
    [rows],
  );

  const switchTab = (tab: LibraryTab) => {
    setActiveTab(tab);
    setQuery("");
    setStatusFilter("all");
    setSort(tab === "mine" ? "recent" : "title-asc");
  };

  const resultsLoading = activeTab === "mine" ? loading : catalogLoading;
  const resultSummary = resultsLoading
    ? "Loading courses..."
    : activeResults.length
      ? `Showing ${pageStart + 1}-${Math.min(pageStart + PAGE_SIZE, activeResults.length)} of ${activeResults.length}`
      : "No matching courses";

  return (
    <AppLayout>
      <PageHeader
        title="Course library"
        subtitle="Continue enrolled courses or explore the full Synergy Academy catalog."
      />

      <div className="mt-6">
        <div
          className="flex border-b border-ink-200"
          role="tablist"
          aria-label="Course library views"
        >
          <LibraryTabButton
            active={activeTab === "mine"}
            onClick={() => switchTab("mine")}
          >
            My Courses{" "}
            <span className="ml-2 tabular-nums text-xs text-ink-400">
              {loading ? "..." : rows.length}
            </span>
          </LibraryTabButton>
          <LibraryTabButton
            active={activeTab === "catalog"}
            onClick={() => switchTab("catalog")}
          >
            Browse Catalog
          </LibraryTabButton>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block sm:min-w-0 sm:flex-1">
            <span className="sr-only">Search courses</span>
            <Search
              size={17}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                activeTab === "mine"
                  ? "Search my courses"
                  : "Search the catalog"
              }
              className="input min-h-11 w-full pl-10 text-base sm:text-sm"
            />
          </label>
          {activeTab === "mine" && (
            <label>
              <span className="sr-only">Filter by enrollment status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="input min-h-11 w-full text-base sm:w-40 sm:text-sm"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
          )}
          <label>
            <span className="sr-only">Sort courses</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as CourseSort)}
              className="input min-h-11 w-full text-base sm:w-44 sm:text-sm"
            >
              {activeTab === "mine" && (
                <option value="recent">Recently enrolled</option>
              )}
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-ink-500">
          <p aria-live="polite">{resultSummary}</p>
          {activeTab === "mine" && rows.length > PAGE_SIZE && (
            <p>Your library is paginated for faster loading.</p>
          )}
        </div>

        <div className="mt-4">
          {activeTab === "mine" ? (
            <MinePanel
              error={error}
              loading={loading}
              rows={visibleRows}
              hasAnyRows={rows.length > 0}
              releasedCounts={releasedCounts}
              hasFilters={Boolean(normalizedQuery || statusFilter !== "all")}
              onBrowse={() => switchTab("catalog")}
            />
          ) : (
            <CatalogPanel
              error={catalogError}
              loading={catalogLoading}
              courses={visibleCatalog}
              hasAnyCourses={catalog.length > 0}
              hasFilters={Boolean(normalizedQuery)}
              enrolledByCourse={enrolledByCourse}
            />
          )}
        </div>

        {activeResults.length > PAGE_SIZE && (
          <nav
            className="mt-6 flex items-center justify-between border-t border-ink-200 pt-4"
            aria-label="Course results pages"
          >
            <button
              type="button"
              className="btn-secondary"
              disabled={safePage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ArrowLeft size={16} /> Previous
            </button>
            <p className="text-xs font-medium tabular-nums text-ink-600">
              Page {safePage} of {totalPages}
            </p>
            <button
              type="button"
              className="btn-secondary"
              disabled={safePage === totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Next <ArrowRight size={16} />
            </button>
          </nav>
        )}
      </div>
    </AppLayout>
  );
}

function LibraryTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-11 border-b-2 px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset ${active ? "border-brand-600 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-800"}`}
    >
      {children}
    </button>
  );
}

function MinePanel({
  error,
  loading,
  rows,
  hasAnyRows,
  hasFilters,
  onBrowse,
}: {
  error: string;
  loading: boolean;
  rows: CourseRow[];
  hasAnyRows: boolean;
  releasedCounts: Record<string, number>;
  hasFilters: boolean;
  onBrowse: () => void;
}) {
  if (error) return <Alert>{error}</Alert>;
  if (loading)
    return (
      <div className="rounded-xl bg-white shadow-soft">
        <TableSkeleton />
      </div>
    );
  if (!rows.length)
    return (
      <div className="rounded-xl bg-white shadow-soft">
        <EmptyState
          icon={<BookOpen size={30} />}
          title={hasFilters ? "No matching courses" : "No enrolled courses yet"}
          description={
            hasFilters
              ? "Try a different search or status filter."
              : hasAnyRows
                ? "No courses match this view."
                : "Browse the catalog to see what is available, or return after an administrator enrolls you."
          }
          action={
            !hasAnyRows ? (
              <button type="button" className="btn-primary" onClick={onBrowse}>
                Browse catalog <ArrowRight size={16} />
              </button>
            ) : undefined
          }
        />
      </div>
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {rows.map((row) => {
        return (
          <Link
            key={row.id}
            to={`/student/courses/${row.cohort_id}/home`}
            className="surface-interactive group min-w-0 rounded-xl bg-white p-5 shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <div className="flex min-w-0 gap-4">
              <CourseCover course={row.cohort.course} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 font-semibold text-ink-900 group-hover:text-brand-700">
                      {row.cohort.course.title}
                    </h2>
                    <p className="mt-0.5 truncate text-sm text-ink-500">
                      {row.cohort.name}
                    </p>
                  </div>
                  <span
                    className={
                      row.status === "active"
                        ? "badge-success"
                        : "badge-neutral"
                    }
                  >
                    {row.status}
                  </span>
                </div>
                <div className="mt-5">
                  <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-xs text-ink-500">
                    <span>Learning path</span>
                    <span className="flex items-center gap-1">
                      <CalendarDays size={13} />
                      {row.cohort.end_date
                        ? `Ends ${formatDate(row.cohort.end_date)}`
                        : "Ongoing access"}
                    </span>
                  </div>
                  <CourseProgress cohortId={row.cohort_id} compact/>
                </div>
                <div className="mt-4 flex items-center justify-end gap-1 text-sm font-medium text-brand-700">
                  Open course <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function CatalogPanel({
  error,
  loading,
  courses,
  hasAnyCourses,
  hasFilters,
  enrolledByCourse,
}: {
  error: string;
  loading: boolean;
  courses: Course[];
  hasAnyCourses: boolean;
  hasFilters: boolean;
  enrolledByCourse: Map<string, CourseRow>;
}) {
  if (error) return <Alert>{error}</Alert>;
  if (loading)
    return (
      <div className="rounded-xl bg-white shadow-soft">
        <TableSkeleton />
      </div>
    );
  if (!courses.length)
    return (
      <div className="rounded-xl bg-white shadow-soft">
        <EmptyState
          icon={<Library size={30} />}
          title={hasFilters ? "No catalog matches" : "No published courses yet"}
          description={
            hasFilters
              ? "Try a broader search term."
              : hasAnyCourses
                ? "No courses match this catalog view."
                : "New courses will appear here after they are reviewed and published."
          }
        />
      </div>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => {
        const enrolment = enrolledByCourse.get(course.id);
        return (
          <article
            key={course.id}
            className="surface-interactive flex min-w-0 flex-col overflow-hidden rounded-xl bg-white shadow-soft"
          >
            {course.cover_image_url ? (
              <img
                src={course.cover_image_url}
                alt=""
                className="aspect-video w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-brand-50 text-brand-600">
                <Library size={28} />
              </div>
            )}
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="line-clamp-2 font-semibold text-ink-900">
                  {course.title}
                </h2>
                {enrolment && (
                  <span className="badge-success shrink-0">
                    <Check size={12} /> Enrolled
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-600">
                {course.short_description ||
                  course.description ||
                  "Course details are being prepared."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-500">
                <span>
                  {course.is_self_paced ? "eLearning" : "Instructor-supported"}
                </span>
                {course.difficulty_level && (
                  <span className="capitalize">
                    · {course.difficulty_level}
                  </span>
                )}
              </div>
              <Link
                className={
                  enrolment
                    ? "btn-primary mt-5 w-full"
                    : "btn-secondary mt-5 w-full"
                }
                to={
                  enrolment
                    ? `/student/courses/${enrolment.cohort_id}/home`
                    : `/courses/${course.slug}`
                }
              >
                {enrolment ? "Open course" : "View course"}{" "}
                <ArrowRight size={15} />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CourseCover({ course }: { course: Course }) {
  return course.cover_image_url ? (
    <img
      src={course.cover_image_url}
      alt=""
      className="h-16 w-20 shrink-0 rounded-xl object-cover"
      loading="lazy"
      decoding="async"
    />
  ) : (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
      <BookOpen size={22} />
    </div>
  );
}

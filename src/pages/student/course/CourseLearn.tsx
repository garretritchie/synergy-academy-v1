import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  LockKeyhole,
} from "lucide-react";
import { CourseLayout } from "./CourseLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Lesson, Module, ProgressRecord } from "@/types";

type ModuleRow = Module & { lessons: Lesson[] };
export function CourseLearn() {
  const { cohortId } = useParams<{ cohortId: string }>();
  const { user } = useAuth();
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [released, setReleased] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cohortId || !user) return;
    void (async () => {
      const { data: cohort, error: cohortError } = await supabase
        .from("cohorts")
        .select("course_id")
        .eq("id", cohortId)
        .single();
      if (cohortError) {
        setError(cohortError.message);
        setLoading(false);
        return;
      }
      const [moduleResult, progressResult, releaseResult] = await Promise.all([
        supabase
          .from("modules")
          .select("*,lessons(*)")
          .eq("course_id", cohort.course_id)
          .eq("is_published", true)
          .order("display_order")
          .order("display_order", { referencedTable: "lessons" }),
        supabase
          .from("progress_records")
          .select("*")
          .eq("cohort_id", cohortId)
          .eq("student_id", user.id),
        supabase.rpc("get_released_lesson_ids", { cohort_uuid: cohortId }),
      ]);
      const queryError =
        moduleResult.error || progressResult.error || releaseResult.error;
      if (queryError) setError(queryError.message);
      else {
        setModules((moduleResult.data ?? []) as unknown as ModuleRow[]);
        setProgress((progressResult.data ?? []) as ProgressRecord[]);
        setReleased((releaseResult.data ?? []) as string[]);
      }
      setLoading(false);
    })();
  }, [cohortId, user]);
  return (
    <CourseLayout>
      <PageHeader
        title="Learn"
        subtitle="Work through released lessons at your own pace."
      />
      <div className="mt-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : modules.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-ink-500">
            <BookOpen className="mx-auto mb-2 text-ink-300" />
            The curriculum has not been published yet.
          </div>
        ) : (
          modules.map((module) => (
            <section
              key={module.id}
              className="overflow-hidden rounded-xl bg-white shadow-soft"
            >
              <div className="border-b border-ink-100 px-5 py-4">
                <h2 className="font-semibold text-ink-900">
                  {module.display_order}. {module.title}
                </h2>
                {module.description && (
                  <p className="mt-1 text-sm text-ink-500">
                    {module.description}
                  </p>
                )}
              </div>
              <div className="divide-y divide-ink-100">
                {module.lessons
                  .filter((lesson) => lesson.is_published)
                  .map((lesson) => {
                    const available = released.includes(lesson.id);
                    const record = progress.find(
                      (item) => item.lesson_id === lesson.id,
                    );
                    const complete = record?.status === "completed";
                    const content = (
                      <>
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${complete ? "bg-success-100 text-success-700" : available ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-400"}`}
                        >
                          {complete ? (
                            <CheckCircle2 size={18} />
                          ) : available ? (
                            <BookOpen size={17} />
                          ) : (
                            <LockKeyhole size={16} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink-900">
                            {lesson.display_order}. {lesson.title}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                            <Clock size={12} />
                            {lesson.estimated_minutes ?? 0} minutes
                            {complete ? " · Completed" : ""}
                          </p>
                        </div>
                        {available && (
                          <ChevronRight size={17} className="text-ink-400" />
                        )}
                      </>
                    );
                    return available ? (
                      <Link
                        key={lesson.id}
                        to={`/student/courses/${cohortId}/learn/${lesson.id}`}
                        className="flex items-center gap-3 px-5 py-4 hover:bg-ink-50"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div
                        key={lesson.id}
                        className="flex items-center gap-3 px-5 py-4 opacity-70"
                      >
                        {content}
                      </div>
                    );
                  })}
              </div>
            </section>
          ))
        )}
      </div>
    </CourseLayout>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Outline } from "./model";

export interface CourseChoice {
  id: string;
  cohort_id: string;
  cohort: {
    id: string;
    name: string;
    course_id: string;
    metadata: Record<string, unknown>;
    course: {
      title: string;
      description: string | null;
      cover_image_url: string | null;
      introduction_video_url: string | null;
    };
  };
}
export function useCompanion() {
  const { user } = useAuth();
  const params = useParams();
  const [search] = useSearchParams();
  const [courses, setCourses] = useState<CourseChoice[]>([]);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const remembered = rememberedCohort(user?.id);
  const selected =
    params.cohortId ??
    search.get("cohort") ??
    (courses.some((c) => c.cohort_id === remembered)
      ? remembered
      : courses[0]?.cohort_id);
  const course = courses.find((c) => c.cohort_id === selected);
  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const result = await supabase
        .from("enrolments")
        .select(
          "id,cohort_id,cohort:cohorts(id,name,course_id,metadata,course:courses(title,description,cover_image_url,introduction_video_url))",
        )
        .eq("student_id", user.id)
        .in("status", ["active", "completed"])
        .order("enrolled_at", { ascending: false });
      if (result.error) throw result.error;
      const choices = (result.data ?? []) as unknown as CourseChoice[];
      setCourses(choices);
      const preferred = rememberedCohort(user.id);
      const id =
        params.cohortId ??
        search.get("cohort") ??
        (choices.some((c) => c.cohort_id === preferred)
          ? preferred
          : choices[0]?.cohort_id);
      setOutline(null);
      if (id && choices.some((c) => c.cohort_id === id)) {
        const r = await supabase.rpc("companion_outline", { cohort_uuid: id });
        if (r.error) throw r.error;
        try {
          sessionStorage.setItem(`companion-cohort:${user.id}`, id);
        } catch {
          /* Navigation still works when storage is disabled. */
        }
        setOutline(r.data as Outline);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : ((e as { message?: string }).message ??
              "Your course could not load. Please retry."),
      );
    } finally {
      setLoading(false);
    }
  }, [user, params.cohortId, search]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return {
    courses,
    course,
    cohortId: selected ?? "",
    outline,
    loading,
    error,
    refresh,
  };
}

function rememberedCohort(userId?: string) {
  try {
    return userId ? sessionStorage.getItem(`companion-cohort:${userId}`) : null;
  } catch {
    return null;
  }
}

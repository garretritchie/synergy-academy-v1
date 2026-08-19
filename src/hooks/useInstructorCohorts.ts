import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Cohort, Course } from "@/types";

export type InstructorCohort = Cohort & { course: Course };
export function useInstructorCohorts() {
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState<InstructorCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data, error: queryError } = await supabase
        .from("cohort_instructors")
        .select("cohort:cohorts(*,course:courses(*))")
        .eq("instructor_id", user.id);
      if (queryError) setError(queryError.message);
      else
        setCohorts(
          (data ?? []).map(
            (item) => item.cohort,
          ) as unknown as InstructorCohort[],
        );
      setLoading(false);
    })();
  }, [user]);
  return { cohorts, loading, error };
}

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Cohort, Course } from "@/types";

export type InstructorCohort = Cohort & { course: Course };
export function useInstructorCohorts() {
  const { user, roles } = useAuth();
  const [cohorts, setCohorts] = useState<InstructorCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const isAdministrator = roles.includes("administrator");
      const query = isAdministrator
        ? supabase
            .from("cohorts")
            .select("*,course:courses(*)")
            .order("start_date", { ascending: false })
        : supabase
            .from("cohort_instructors")
            .select("cohort:cohorts(*,course:courses(*))")
            .eq("instructor_id", user.id);
      const { data, error: queryError } = await query;
      if (queryError) setError(queryError.message);
      else if (isAdministrator)
        setCohorts((data ?? []) as unknown as InstructorCohort[]);
      else
        setCohorts(
          (data ?? []).map((item) => item.cohort) as unknown as InstructorCohort[],
        );
      setLoading(false);
    })();
  }, [roles, user]);
  return { cohorts, loading, error };
}

import { useCallback, useEffect, useState } from "react";
import { Search, ShieldCheck, UserRound } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase";
import { fullName } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import type { Profile, Role, UserRole } from "@/types";

type UserRow = Profile & {
  user_roles: Array<{ id: string; role_id: string; role: Role }>;
};
const roleLabels: Record<UserRole, string> = {
  administrator: "Administrator",
  instructor: "Instructor",
  student: "Student",
};

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    const [userResult, roleResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("*, user_roles(id,role_id,role:roles(*))")
        .order("created_at", { ascending: false }),
      supabase.from("roles").select("*").order("name"),
    ]);
    const queryError = userResult.error || roleResult.error;
    if (queryError) setError(queryError.message);
    else {
      setUsers((userResult.data ?? []) as unknown as UserRow[]);
      setRoles((roleResult.data ?? []) as Role[]);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const toggleRole = async (user: UserRow, role: Role) => {
    const assignment = user.user_roles.find((item) => item.role_id === role.id);
    if (
      user.id === currentUser?.id &&
      role.name === "administrator" &&
      assignment
    ) {
      setError("You cannot remove your own administrator role.");
      return;
    }
    setSaving(`${user.id}:${role.id}`);
    setError("");
    const result = assignment
      ? await supabase.from("user_roles").delete().eq("id", assignment.id)
      : await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role_id: role.id });
    if (result.error) setError(result.error.message);
    else await load();
    setSaving("");
  };
  const toggleActive = async (user: UserRow) => {
    if (user.id === currentUser?.id && user.is_active) {
      setError("You cannot deactivate your own account.");
      return;
    }
    setSaving(user.id);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_active: !user.is_active })
      .eq("id", user.id);
    if (updateError) setError(updateError.message);
    else await load();
    setSaving("");
  };
  const filtered = users.filter((user) =>
    `${fullName(user)} ${user.email}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <AppLayout>
      <PageHeader
        title="Users & roles"
        subtitle="One account can hold multiple RLS-governed roles."
      />
      <div className="mt-6 space-y-5">
        <div className="rounded-xl bg-white p-4 shadow-soft">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              size={17}
            />
            <input
              className="input pl-10"
              placeholder="Search by name or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <p className="mt-3 text-xs text-ink-500">
            New people create an account from the sign-up page. Administrators
            then approve access by assigning one or more roles here.
          </p>
        </div>
        {error && <Alert>{error}</Alert>}
        <section className="overflow-hidden rounded-xl bg-white shadow-soft">
          {loading ? (
            <TableSkeleton />
          ) : (
            <div className="divide-y divide-ink-100">
              {filtered.map((user) => (
                <article key={user.id} className="px-5 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700">
                        <UserRound size={19} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">
                          {fullName(user)}
                        </p>
                        <p className="truncate text-sm text-ink-500">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => {
                        const active = user.user_roles.some(
                          (item) => item.role_id === role.id,
                        );
                        const key = `${user.id}:${role.id}`;
                        return (
                          <button
                            key={role.id}
                            type="button"
                            disabled={saving === key}
                            onClick={() => void toggleRole(user, role)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${active ? "bg-brand-100 text-brand-800" : "bg-ink-50 text-ink-600 hover:bg-ink-100"}`}
                          >
                            {active && <ShieldCheck size={14} />}
                            {roleLabels[role.name]}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={saving === user.id}
                      onClick={() => void toggleActive(user)}
                      className={
                        user.is_active
                          ? "badge-success justify-center py-2"
                          : "badge-danger justify-center py-2"
                      }
                    >
                      {user.is_active ? "Active" : "Disabled"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

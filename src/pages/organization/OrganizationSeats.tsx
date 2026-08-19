import { useCallback, useEffect, useState } from "react";
import { Building2, UserPlus, Users, XCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, TableSkeleton } from "@/components/ui/Feedback";
import { EmptyState } from "@/components/ui/Spinner";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { formatDate, getErrorMessage } from "@/lib/format";

type ManagedMembership = {
  organization_id: string;
  member_role: "owner" | "seat_manager";
  organization: { id: string; name: string };
};
type Seat = {
  id: string;
  status: "active" | "revoked";
  assigned_at: string;
  user: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
};
type Contract = {
  id: string;
  organization_id: string;
  seat_limit: number;
  starts_at: string;
  ends_at: string;
  status: string;
  offering: {
    name: string;
    access_scope: "course" | "platform";
    term_months: number | null;
    course: { title: string } | null;
  };
  seat_assignments: Seat[];
};

export function OrganizationSeats() {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<ManagedMembership[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    const { data: memberRows, error: memberError } = await supabase
      .from("organization_members")
      .select("organization_id,member_role,organization:organizations(id,name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("member_role", ["owner", "seat_manager"]);
    if (memberError) {
      const missing = memberError.message.toLowerCase().includes("schema cache");
      setError(
        missing
          ? "Organization seat management is not enabled in the connected database yet. Apply migration 013, then refresh this page."
          : memberError.message,
      );
      setLoading(false);
      return;
    }
    const managed = (memberRows ?? []) as unknown as ManagedMembership[];
    setMemberships(managed);
    if (!managed.length) {
      setContracts([]);
      setLoading(false);
      return;
    }
    const { data: contractRows, error: contractError } = await supabase
      .from("access_contracts")
      .select(
        "id,organization_id,seat_limit,starts_at,ends_at,status,offering:access_offerings(name,access_scope,term_months,course:courses(title)),seat_assignments(id,status,assigned_at,user:profiles(first_name,last_name,email))",
      )
      .in(
        "organization_id",
        managed.map((membership) => membership.organization_id),
      )
      .order("ends_at", { ascending: false });
    if (contractError) setError(contractError.message);
    else setContracts((contractRows ?? []) as unknown as Contract[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const assignSeat = async (contractId: string) => {
    const email = emails[contractId]?.trim();
    if (!email) return;
    setSaving(contractId);
    setError("");
    setNotice("");
    const { error: rpcError } = await supabase.rpc(
      "assign_organization_seat_by_email",
      { contract_uuid: contractId, learner_email: email },
    );
    if (rpcError) setError(rpcError.message);
    else {
      setEmails((current) => ({ ...current, [contractId]: "" }));
      setNotice(`Seat assigned to ${email}.`);
      await load();
    }
    setSaving("");
  };

  const revokeSeat = async (seatId: string) => {
    setSaving(seatId);
    setError("");
    const { error: rpcError } = await supabase.rpc("revoke_organization_seat", {
      seat_uuid: seatId,
    });
    if (rpcError) setError(getErrorMessage(rpcError));
    else await load();
    setSaving("");
  };

  return (
    <AppLayout>
      <PageHeader
        title="Company seats"
        subtitle="Assign and manage learner access within your organization’s active contract limits."
      />
      <div className="mt-6 space-y-5">
        {error && <Alert>{error}</Alert>}
        {notice && (
          <div className="rounded-lg bg-success-50 px-4 py-3 text-sm text-success-800">
            {notice}
          </div>
        )}
        {loading ? (
          <div className="rounded-xl bg-white shadow-soft">
            <TableSkeleton />
          </div>
        ) : !memberships.length ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState
              icon={<Building2 size={30} />}
              title="No company access to manage"
              description="This workspace appears after an administrator designates you as an organization contact or seat manager."
            />
          </div>
        ) : contracts.length === 0 ? (
          <div className="rounded-xl bg-white shadow-soft">
            <EmptyState
              icon={<Users size={30} />}
              title="No contracts yet"
              description="Your organization is set up, but an administrator has not activated an access contract."
            />
          </div>
        ) : (
          contracts.map((contract) => {
            const activeSeats = contract.seat_assignments.filter(
              (seat) => seat.status === "active",
            );
            const remaining = Math.max(0, contract.seat_limit - activeSeats.length);
            const active =
              contract.status === "active" &&
              new Date(contract.starts_at) <= new Date() &&
              new Date(contract.ends_at) > new Date();
            const organization = memberships.find(
              (membership) => membership.organization_id === contract.organization_id,
            )?.organization;
            return (
              <section key={contract.id} className="rounded-xl bg-white p-5 shadow-soft">
                <div className="flex flex-col gap-3 border-b border-ink-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                      {organization?.name}
                    </p>
                    <h2 className="mt-1 font-semibold text-ink-950">
                      {contract.offering.name}
                    </h2>
                    <p className="mt-1 text-xs text-ink-500">
                      {contract.offering.access_scope === "platform"
                        ? "Entire platform"
                        : contract.offering.course?.title || "Selected course"}
                      {" · "}Valid through {formatDate(contract.ends_at)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-brand-50 px-3 py-2 text-right">
                    <p className="text-lg font-semibold tabular-nums text-brand-800">
                      {activeSeats.length}/{contract.seat_limit}
                    </p>
                    <p className="text-[11px] text-brand-700">seats assigned</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    className="input"
                    placeholder="employee@company.com"
                    value={emails[contract.id] || ""}
                    onChange={(event) =>
                      setEmails((current) => ({
                        ...current,
                        [contract.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!active || remaining === 0 || saving === contract.id}
                    onClick={() => void assignSeat(contract.id)}
                  >
                    <UserPlus size={15} /> Assign seat
                  </button>
                </div>
                <p className="mt-2 text-xs text-ink-500">
                  {active
                    ? `${remaining} seat${remaining === 1 ? "" : "s"} available. The learner must create an academy account first.`
                    : "This contract is not currently active."}
                </p>
                {activeSeats.length > 0 && (
                  <div className="mt-4 divide-y divide-ink-100 rounded-lg border border-ink-100">
                    {activeSeats.map((seat) => (
                      <div key={seat.id} className="flex items-center gap-3 px-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {[seat.user.first_name, seat.user.last_name]
                              .filter(Boolean)
                              .join(" ") || seat.user.email}
                          </p>
                          <p className="truncate text-xs text-ink-500">{seat.user.email}</p>
                        </div>
                        <button
                          type="button"
                          className="btn-ghost text-danger-600"
                          disabled={saving === seat.id}
                          onClick={() => void revokeSeat(seat.id)}
                        >
                          <XCircle size={15} /> Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}

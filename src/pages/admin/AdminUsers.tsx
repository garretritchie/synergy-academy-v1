import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, KeyRound, RefreshCw, Search, ShieldCheck, UserPlus, UserRound } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert, SubmitButton, TableSkeleton } from "@/components/ui/Feedback";
import { Field, FormPanel } from "@/components/ui/FormPanel";
import { supabase } from "@/lib/supabase";
import { fullName, getErrorMessage } from "@/lib/format";
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<"manual" | "invite">("manual");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState(() => generateTemporaryPassword());
  const [sendWelcome, setSendWelcome] = useState(false);
  const [sendInvitationEmail, setSendInvitationEmail] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [createdMessage, setCreatedMessage] = useState("");
  const [invite, setInvite] = useState({
    first_name: "",
    last_name: "",
    email: "",
    roles: ["student"] as UserRole[],
  });
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
  useEffect(() => {
    void supabase
      .rpc("email_delivery_enabled")
      .then(({ data }) => setEmailEnabled(data === true));
  }, []);
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
  const toggleInviteRole = (role: UserRole) => {
    setInvite((current) => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter((item) => item !== role)
        : [...current.roles, role],
    }));
  };
  const createInvitation = async (event: FormEvent) => {
    event.preventDefault();
    if (!invite.roles.length) {
      setError("Choose at least one role for the invited account.");
      return;
    }
    setInviteSaving(true);
    setError("");
    setInviteLink("");
    const { data, error: inviteError } = await supabase.rpc(
      "create_user_invitation",
      {
        invite_email: invite.email.trim(),
        invite_first_name: invite.first_name.trim(),
        invite_last_name: invite.last_name.trim(),
        invited_roles: invite.roles,
        expires_in_days: 7,
      },
    );
    if (inviteError) {
      setError(
        `${inviteError.message}. Apply migration 013 if invitations are not available yet.`,
      );
    } else {
      const token = (data as { token: string }).token;
      const link = `${window.location.origin}/signup?invite=${token}`;
      setInviteLink(link);
      if (sendInvitationEmail && emailEnabled) {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          "academy-email",
          {
            body: {
              type: "invitation",
              email: invite.email.trim(),
              subject: "You’re invited to Synergy Academy",
              body: `Hello ${invite.first_name.trim()},\n\nCreate your Synergy Academy account using this secure link within seven days:\n${link}`,
            },
          },
        );
        setCreatedMessage(
          emailError
            ? "Invitation link created, but the email request could not be processed."
            : emailResult?.suppressed
              ? "Invitation link created. Email was suppressed by the testing kill switch."
              : "Invitation link created and emailed.",
        );
      }
    }
    setInviteSaving(false);
  };
  const createManualUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!invite.roles.length) {
      setError("Choose at least one role for the new account.");
      return;
    }
    setInviteSaving(true);
    setError("");
    setCreatedMessage("");
    const { data, error: functionError } = await supabase.functions.invoke(
      "admin-create-user",
      {
        body: {
          email: invite.email.trim(),
          first_name: invite.first_name.trim(),
          last_name: invite.last_name.trim(),
          password: temporaryPassword,
          roles: invite.roles,
          send_welcome: sendWelcome && emailEnabled,
          sign_in_url: `${window.location.origin}/signin`,
        },
      },
    );
    if (functionError || data?.error) {
      setError(data?.error || getErrorMessage(functionError));
    } else {
      const delivery = data?.email_delivery;
      setCreatedMessage(
        sendWelcome && delivery?.suppressed
          ? "Account created. The welcome email was suppressed because email delivery is disabled."
          : "Account created and ready to enrol. Share the temporary password securely and separately from email.",
      );
      await load();
    }
    setInviteSaving(false);
  };
  const copyInvitation = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
        subtitle="Create or invite people, approve access, and assign one or more RLS-governed roles."
      />
      <div className="mt-6 space-y-5">
        <FormPanel
          title="Add a user"
          description="Create the account manually now, or generate an optional self-registration invitation."
          open={inviteOpen}
          onToggle={() => {
            setInviteOpen((current) => !current);
            setInviteLink("");
            setCreatedMessage("");
          }}
          actionLabel="Add user"
        >
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-ink-50 p-1">
            <button
              type="button"
              onClick={() => {
                setCreationMode("manual");
                setInviteLink("");
                setCreatedMessage("");
              }}
              className={`min-h-10 rounded-md text-xs font-semibold ${creationMode === "manual" ? "bg-white text-brand-700 shadow-sm" : "text-ink-500"}`}
            >
              Create manually
            </button>
            <button
              type="button"
              onClick={() => {
                setCreationMode("invite");
                setInviteLink("");
                setCreatedMessage("");
              }}
              className={`min-h-10 rounded-md text-xs font-semibold ${creationMode === "invite" ? "bg-white text-brand-700 shadow-sm" : "text-ink-500"}`}
            >
              Invite instead
            </button>
          </div>
          <form onSubmit={creationMode === "manual" ? createManualUser : createInvitation} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name">
                <input
                  required
                  className="input"
                  value={invite.first_name}
                  onChange={(event) =>
                    setInvite((current) => ({ ...current, first_name: event.target.value }))
                  }
                />
              </Field>
              <Field label="Last name">
                <input
                  required
                  className="input"
                  value={invite.last_name}
                  onChange={(event) =>
                    setInvite((current) => ({ ...current, last_name: event.target.value }))
                  }
                />
              </Field>
            </div>
            <Field label="Email address">
              <input
                required
                type="email"
                className="input"
                value={invite.email}
                onChange={(event) =>
                  setInvite((current) => ({ ...current, email: event.target.value }))
                }
              />
            </Field>
            <fieldset>
              <legend className="label">Workspace access</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(roleLabels) as UserRole[]).map((role) => {
                  const active = invite.roles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleInviteRole(role)}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${active ? "bg-brand-100 text-brand-800" : "bg-ink-50 text-ink-600"}`}
                    >
                      {active && <Check size={14} />} {roleLabels[role]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {creationMode === "manual" && (
              <>
                <Field label="Temporary password" hint="Give this to the user through a secure channel. It is never included in welcome email.">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <div className="relative">
                      <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                      <input
                        required
                        minLength={10}
                        className="input pl-10 font-mono"
                        value={temporaryPassword}
                        onChange={(event) => setTemporaryPassword(event.target.value)}
                      />
                    </div>
                    <button type="button" className="btn-secondary" onClick={() => setTemporaryPassword(generateTemporaryPassword())}>
                      <RefreshCw size={15} /> Generate
                    </button>
                  </div>
                </Field>
                <label className={`flex items-start gap-3 rounded-lg border p-3 text-xs ${emailEnabled ? "border-ink-200 text-ink-700" : "border-ink-100 bg-ink-50 text-ink-400"}`}>
                  <input
                    type="checkbox"
                    checked={sendWelcome}
                    disabled={!emailEnabled}
                    onChange={(event) => setSendWelcome(event.target.checked)}
                  />
                  <span>
                    <strong className="block text-ink-800">Send welcome email</strong>
                    {emailEnabled ? "Sends the sign-in address only; share the temporary password separately." : "Email delivery is currently disabled in Settings."}
                  </span>
                </label>
              </>
            )}
            {creationMode === "invite" && (
              <label className={`flex items-start gap-3 rounded-lg border p-3 text-xs ${emailEnabled ? "border-ink-200 text-ink-700" : "border-ink-100 bg-ink-50 text-ink-400"}`}>
                <input
                  type="checkbox"
                  checked={sendInvitationEmail}
                  disabled={!emailEnabled}
                  onChange={(event) => setSendInvitationEmail(event.target.checked)}
                />
                <span>
                  <strong className="block text-ink-800">Email the invitation link</strong>
                  {emailEnabled ? "The user receives the seven-day registration link through SMTP2GO." : "Email delivery is currently disabled in Settings; copy the link manually instead."}
                </span>
              </label>
            )}
            {createdMessage && (
              <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-xs leading-5 text-success-800">
                <p>{createdMessage}</p>
                {creationMode === "manual" && (
                  <Link to="/admin/enrolments" className="btn-secondary mt-3">
                    Continue to enrolment
                  </Link>
                )}
              </div>
            )}
            {creationMode === "invite" && inviteLink ? (
              <div className="rounded-lg border border-success-200 bg-success-50 p-4">
                <p className="text-xs font-semibold text-success-800">Invitation ready</p>
                <p className="mt-1 break-all text-xs leading-5 text-success-800">{inviteLink}</p>
                <button type="button" className="btn-secondary mt-3" onClick={() => void copyInvitation()}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy sign-up link"}
                </button>
              </div>
            ) : !createdMessage && (
              <div className="flex justify-end">
                <SubmitButton loading={inviteSaving}>
                  <UserPlus size={16} /> {creationMode === "manual" ? "Create account" : "Create invitation"}
                </SubmitButton>
              </div>
            )}
          </form>
        </FormPanel>
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
            Existing accounts appear below. Manual creation is the default; invitation links remain available when self-registration is preferred.
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

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

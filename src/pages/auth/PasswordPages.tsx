import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Lock, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Alert } from "@/components/ui/Feedback";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-ink-50 p-6">
      <section className="w-full max-w-md rounded-xl border border-ink-100 bg-white p-7 shadow-elevated">
        <img
          src="/brand/synergy-bahamas-logo-full-color.png"
          alt="Synergy Bahamas"
          className="mb-8 h-auto w-52"
        />
        <AcademyBrandMark compact className="-mt-5 mb-7" />
        {children}
      </section>
    </main>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const { data: emailEnabled, error: settingError } = await supabase.rpc(
      "email_delivery_enabled",
    );
    if (!settingError && emailEnabled !== true) {
      setError(
        "Email delivery is temporarily disabled. Contact Synergy Bahamas for help accessing your account.",
      );
      setLoading(false);
      return;
    }
    const { error: resetError } = await supabase.functions.invoke(
      "request-password-reset",
      {
        body: {
          email,
          redirect_to: `${window.location.origin}/reset-password`,
        },
      },
    );
    if (resetError) setError("The reset request could not be processed. Please try again.");
    else setSent(true);
    setLoading(false);
  };
  return (
    <AuthCard>
      <Link
        className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-700"
        to="/signin"
      >
        <ArrowLeft size={15} />
        Back to sign in
      </Link>
      <h1 className="mt-6 font-display text-2xl font-semibold text-ink-950">
        Reset your password
      </h1>
      <p className="mt-2 text-sm leading-6 text-ink-600">
        Enter your account email and we’ll send a secure reset link.
      </p>
      {sent ? (
        <div className="mt-6 rounded-lg bg-success-50 p-4 text-sm text-success-800">
          <CheckCircle2 className="mb-2" size={20} />
          Check your inbox for the reset link. You can close this page.
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && <Alert>{error}</Alert>}
          <label className="block">
            <span className="label">Email address</span>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                size={17}
              />
              <input
                required
                type="email"
                autoComplete="email"
                className="input pl-10"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </label>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    if (updateError) setError(updateError.message);
    else navigate("/");
    setLoading(false);
  };
  return (
    <AuthCard>
      <h1 className="font-display text-2xl font-semibold text-ink-950">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm leading-6 text-ink-600">
        Use at least 10 characters and avoid reusing another account’s password.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {error && <Alert>{error}</Alert>}
        <label className="block">
          <span className="label">New password</span>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              size={17}
            />
            <input
              required
              type="password"
              minLength={10}
              autoComplete="new-password"
              className="input pl-10"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </label>
        <label className="block">
          <span className="label">Confirm password</span>
          <input
            required
            type="password"
            minLength={10}
            autoComplete="new-password"
            className="input"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthCard>
  );
}

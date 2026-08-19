import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";

export function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    const { error } = await signUp(email, password, firstName, lastName);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/pending"), 2000);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-50 lg:grid lg:grid-cols-2">
      {/* Left branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#07172B] p-12 lg:flex">
        <img
          src="/brand/synergy-bahamas-logo-white.png"
          alt="Synergy Bahamas"
          className="relative z-10 h-auto w-60 object-contain object-left"
        />
        <AcademyBrandMark tone="light" className="relative z-10 mt-3" />

        <div className="relative z-10 text-white">
          <h1 className="text-3xl font-bold leading-tight">
            Join the
            <br />
            learning community.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-brand-100">
            Create your account to access courses, live sessions, assignments,
            and your personal academic records.
          </p>
        </div>

        <div className="relative z-10 space-y-3 text-brand-100">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-brand-300" />
            <span className="text-xs">
              Self-paced lessons with live recap sessions
            </span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-brand-300" />
            <span className="text-xs">
              Track your progress and grades in real time
            </span>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="text-brand-300" />
            <span className="text-xs">
              Earn certificates on course completion
            </span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <img
            src="/brand/synergy-bahamas-logo-full-color.png"
            alt="Synergy Bahamas"
            className="mb-8 h-auto w-52 object-contain object-left lg:hidden"
          />
          <AcademyBrandMark compact className="-mt-5 mb-7 lg:hidden" />

          <h2 className="text-2xl font-bold text-ink-900">
            Create your account
          </h2>
          <p className="mt-1.5 text-sm text-ink-500">
            Start your learning journey today.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-danger-50 px-3.5 py-3 text-sm text-danger-700">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-lg bg-success-50 px-3.5 py-3 text-sm text-success-700">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>
                  Account created. Redirecting while an administrator assigns
                  access…
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="firstName">
                  First name
                </label>
                <div className="relative">
                  <User
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  />
                  <input
                    id="firstName"
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="input pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="lastName">
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="password"
                  type="password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 10 characters"
                  className="input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            Already have an account?{" "}
            <Link
              to="/signin"
              className="font-semibold text-brand-600 hover:text-brand-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

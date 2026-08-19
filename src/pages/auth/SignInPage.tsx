import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Lock,
  AlertCircle,
  ArrowUpRight,
  KeyRound,
  Phone,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    {
      role: "Demo admin",
      email: import.meta.env.VITE_DEMO_ADMIN_EMAIL,
      password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD,
    },
    {
      role: "Demo student",
      email: import.meta.env.VITE_DEMO_STUDENT_EMAIL,
      password: import.meta.env.VITE_DEMO_STUDENT_PASSWORD,
    },
  ].filter(
    (account): account is { role: string; email: string; password: string } =>
      Boolean(account.email && account.password),
  );
  const demoMode =
    import.meta.env.VITE_DEMO_MVP_MODE === "true" && demoAccounts.length > 0;

  const fillDemoAccount = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      navigate("/");
    }
  };

  return (
    <main className="min-h-[100dvh] bg-canvas font-sans text-navy lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className="relative hidden min-h-[100dvh] flex-col justify-between overflow-hidden bg-navy px-12 py-11 text-white lg:flex xl:px-16 xl:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-56 top-24 h-[34rem] w-[34rem] rounded-full border border-brand-500/15" />
          <div className="absolute bottom-0 left-0 h-1 w-32 bg-accent-400" />
          <div className="absolute bottom-0 left-32 h-1 w-48 bg-brand-500" />
        </div>

        <img
          src="/brand/synergy-bahamas-logo-white.png"
          alt="Synergy Bahamas"
          width="2810"
          height="964"
          className="relative z-10 h-auto w-60 object-contain object-left xl:w-72"
        />
        <div className="relative z-10 max-w-xl pb-8">
          <div
            className="mb-7 h-1 w-14 rounded-full bg-brand-500"
            aria-hidden="true"
          />
          <h1 className="max-w-lg font-display text-3xl font-bold leading-[1.12] tracking-[-0.03em] xl:text-4xl">
            Learn smarter.
            <br />
            Achieve more.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
            Build skills at your pace with practical eLearning courses, guided
            pathways, and live instructor support when it matters.
          </p>
        </div>

        <div className="relative z-10 max-w-lg border-t border-white/15 pt-7">
          <a
            href="https://www.synergybahamas.com"
            target="_blank"
            rel="noreferrer"
            className="group flex items-center justify-between rounded-lg text-white transition-colors hover:text-brand-200 focus-visible:text-brand-200 focus-visible:ring-brand-400 focus-visible:ring-offset-4 focus-visible:ring-offset-navy"
          >
            <span>
              <span className="block font-display text-sm font-bold">
                Visit Synergy Bahamas
              </span>
              <span className="mt-1 block text-xs text-slate-300">
                synergybahamas.com
              </span>
            </span>
            <ArrowUpRight
              size={24}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
          <p className="mt-4 text-xs text-slate-400">
            © {currentYear} Synergy Bahamas. All rights reserved.
          </p>
        </div>
      </section>

      <section className="flex min-h-[100dvh] items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
        <div className="w-full max-w-[29rem] rounded-xl border border-ink-100 bg-white px-6 py-8 shadow-elevated sm:px-9 sm:py-9">
          <img
            src="/brand/synergy-bahamas-logo-full-color.png"
            alt="Synergy Bahamas"
            width="2810"
            height="964"
            className="mb-10 h-auto w-48 object-contain object-left lg:hidden"
          />
          <AcademyBrandMark compact className="mb-7" />

          <h2 className="font-display text-2xl font-semibold leading-tight text-navy">
            Welcome back
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in to access your learning dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {error && (
              <div
                className="flex items-start gap-2.5 rounded-lg bg-red-50 px-4 py-3 text-sm leading-5 text-red-800"
                role="alert"
              >
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                className="label"
                htmlFor="email"
              >
                Email address
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="input h-11 pl-11 pr-4"
                />
              </div>
            </div>

            <div>
              <label
                className="label"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Your password"
                  className="input h-11 pl-11 pr-4"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-1 h-11 w-full font-display"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {demoMode && (
            <section
              className="mt-5 overflow-hidden rounded-lg border border-brand-200 bg-brand-50/60"
              aria-labelledby="demo-access-title"
            >
              <div className="flex items-start gap-2.5 border-b border-brand-200 px-3.5 py-3">
                <KeyRound
                  size={16}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-brand-600"
                />
                <div>
                  <h3
                    id="demo-access-title"
                    className="text-xs font-semibold text-navy"
                  >
                    Demo MVP access
                  </h3>
                  <p className="mt-0.5 text-xs leading-4 text-slate-500">
                    Choose an account to preview the appropriate workspace.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-brand-100">
                {demoAccounts.map((account) => (
                  <div
                    key={account.role}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3"
                  >
                    <div className="min-w-0 text-xs leading-4 text-slate-600">
                      <p className="font-semibold text-navy">
                        {account.role}
                      </p>
                      <p className="truncate" title={account.email}>
                        {account.email}
                      </p>
                      <p className="break-all font-mono text-xs text-slate-500">
                        {account.password}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        fillDemoAccount(account.email, account.password)
                      }
                      className="min-h-10 rounded-md border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-brand-400"
                      aria-label={`Use ${account.role.toLowerCase()} credentials`}
                    >
                      Use account
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <Link
              to="/forgot-password"
              className="font-semibold text-brand-700 hover:text-brand-800 hover:underline"
            >
              Forgot password?
            </Link>
            <p>
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-semibold text-brand-700 hover:text-brand-800 hover:underline"
              >
                Create one
              </Link>
            </p>
          </div>

          <div className="mt-7 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
            <p>
              Synergy Academy is the eLearning Platform of Synergy Bahamas.
            </p>
            <address className="mt-3 not-italic">
              <p className="font-semibold text-slate-700">Contact Information</p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={12} aria-hidden="true" />
                  <a className="hover:text-brand-700 hover:underline" href="tel:+12423230727">
                    (242) 323-0727
                  </a>
                  <span aria-hidden="true">/</span>
                  <a className="hover:text-brand-700 hover:underline" href="tel:+12426016016">
                    (242) 601-6016
                  </a>
                </span>
                <a
                  className="inline-flex items-center gap-1.5 hover:text-brand-700 hover:underline"
                  href="mailto:info@synergybahamas.com"
                >
                  <Mail size={12} aria-hidden="true" />
                  info@synergybahamas.com
                </a>
              </div>
            </address>
          </div>
        </div>
      </section>
    </main>
  );
}

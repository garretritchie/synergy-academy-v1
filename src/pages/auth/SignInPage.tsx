import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, AlertCircle, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <main className="min-h-[100dvh] bg-[#f5f5f5] font-sans text-[#0a1628] lg:grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className="relative hidden min-h-[100dvh] flex-col justify-between overflow-hidden bg-[#0a1628] px-12 py-11 text-white lg:flex xl:px-16 xl:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-56 top-24 h-[34rem] w-[34rem] rounded-full border border-[#0066ff]/15" />
          <div className="absolute bottom-0 left-0 h-1 w-32 bg-[#ffc107]" />
          <div className="absolute bottom-0 left-32 h-1 w-48 bg-[#0066ff]" />
        </div>

        <img
          src="/brand/synergy-bahamas-logo-white.png"
          alt="Synergy Bahamas"
          width="2810"
          height="964"
          className="relative z-10 h-auto w-60 object-contain object-left xl:w-72"
        />
        <AcademyBrandMark tone="light" className="relative z-10 mt-3" />

        <div className="relative z-10 max-w-xl pb-8">
          <div
            className="mb-7 h-1 w-14 rounded-full bg-[#0066ff]"
            aria-hidden="true"
          />
          <h1 className="max-w-lg font-display text-3xl font-bold leading-[1.12] tracking-[-0.03em] xl:text-4xl">
            Learn smarter.
            <br />
            Achieve more.
          </h1>
          <p className="mt-5 max-w-md text-[13px] leading-6 text-slate-300">
            Instructor-led courses with live sessions, structured curriculum,
            and personalized academic records in one place.
          </p>
        </div>

        <a
          href="https://www.synergybahamas.com"
          target="_blank"
          rel="noreferrer"
          className="group relative z-10 flex max-w-lg items-center justify-between border-t border-white/15 pt-7 text-white outline-none transition-colors hover:text-[#7eb3ff] focus-visible:text-[#7eb3ff] focus-visible:ring-2 focus-visible:ring-[#0066ff] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a1628]"
        >
          <span>
            <span className="block font-display text-sm font-bold">
              Visit Synergy Bahamas
            </span>
            <span className="mt-1 block text-[11px] text-slate-300">
              synergybahamas.com
            </span>
          </span>
          <ArrowUpRight
            size={24}
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </a>
      </section>

      <section className="flex min-h-[100dvh] items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
        <div className="w-full max-w-[29rem] rounded-xl border border-white bg-white px-6 py-8 shadow-[0_24px_70px_-38px_rgba(10,22,40,0.45)] sm:px-9 sm:py-9">
          <img
            src="/brand/synergy-bahamas-logo-full-color.png"
            alt="Synergy Bahamas"
            width="2810"
            height="964"
            className="mb-10 h-auto w-48 object-contain object-left lg:hidden"
          />
          <AcademyBrandMark compact className="-mt-7 mb-8 lg:hidden" />

          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[#0a1628]">
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
                className="mb-1.5 block text-xs font-semibold text-[#0a1628]"
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
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-11 pr-4 text-sm text-[#0a1628] outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#0066ff] focus:ring-4 focus:ring-[#0066ff]/10"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  className="block text-xs font-semibold text-[#0a1628]"
                  htmlFor="password"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-[#0066ff] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
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
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-11 pr-4 text-sm text-[#0a1628] outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#0066ff] focus:ring-4 focus:ring-[#0066ff]/10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#0066ff] px-5 font-display text-[13px] font-semibold text-white shadow-[0_12px_26px_-14px_rgba(0,102,255,0.9)] transition hover:bg-[#0057d9] focus:outline-none focus:ring-4 focus:ring-[#0066ff]/25 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="font-semibold text-[#0066ff] underline-offset-4 hover:text-[#004fc7] hover:underline focus:outline-none focus:ring-2 focus:ring-[#0066ff]/30"
            >
              Create one
            </Link>
          </p>

          <div className="mt-7 border-t border-slate-200 pt-5 text-[11px] leading-5 text-slate-500">
            <span>
              Synergy Academy is the learning platform of Synergy Bahamas.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

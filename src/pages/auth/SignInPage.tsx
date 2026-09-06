import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, AlertCircle, ArrowUpRight, ArrowRight, KeyRound, Eye, EyeOff, LoaderCircle, BookOpen, PencilLine, CircleCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AcademyBrandMark } from "@/components/brand/AcademyBrandMark";
import "./sign-in.css";

// Keep the brand story separate from the account controls on smaller screens.
const learningSteps = [
  { icon: BookOpen, title: "Learn it", text: "Clear lessons. One topic at a time." },
  { icon: PencilLine, title: "Put it to work", text: "Practical skills you can use beyond the course." },
  { icon: CircleCheck, title: "See your progress", text: "Your courses and next steps, together." },
];

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    { role: "Demo student", email: import.meta.env.VITE_DEMO_STUDENT_EMAIL, password: import.meta.env.VITE_DEMO_STUDENT_PASSWORD },
    { role: "Demo admin", email: import.meta.env.VITE_DEMO_ADMIN_EMAIL, password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD },
  ].filter((account): account is { role: string; email: string; password: string } => Boolean(account.email && account.password));
  const demoMode = import.meta.env.VITE_DEMO_MVP_MODE === "true" && demoAccounts.length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await signIn(email.trim(), password);
      if (result.error) setError(result.error);
      else navigate("/");
    } catch {
      setError("We couldn't sign you in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="academy-signin font-sans text-navy">
      <div className="signin-shell">
        <section className="signin-story" aria-labelledby="signin-story-title">
          <div className="signin-orbits" aria-hidden="true"><span /><span /><span /></div>
          <img src="/brand/synergy-bahamas-logo-white.png" alt="Synergy Bahamas" width="2810" height="964" className="relative w-44 object-contain" />
          <div className="signin-story-copy">
            <p className="signin-eyebrow"><span aria-hidden="true" /> YOUR LEARNING. YOUR NEXT CHAPTER.</p>
            <h2 id="signin-story-title">Practical skills.<br /><span>Real progress.</span></h2>
            <p className="signin-story-intro">A place to build your confidence, grow your skills, and move forward—with learning that connects to real work.</p>
            <div className="signin-steps">
              {learningSteps.map(({ icon: Icon, title, text }) => (
                <div key={title} className="signin-step">
                  <span className="signin-step-icon"><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>
                  <div><h3>{title}</h3><p>{text}</p></div>
                </div>
              ))}
            </div>
          </div>
          <a href="https://www.synergybahamas.com" target="_blank" rel="noreferrer" className="signin-provider-link">
            <span>Learning with Synergy Bahamas</span><ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </section>

        <section className="signin-entry" aria-labelledby="signin-title">
          <div className="signin-form-wrap">
            <AcademyBrandMark className="signin-brand" />
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-700">YOUR ACADEMY</p>
            <h1 id="signin-title" className="text-[30px] font-semibold leading-tight tracking-[-0.035em]">Welcome back.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Sign in and pick up where you left off.</p>
            <form onSubmit={handleSubmit} className="mt-7 space-y-5" aria-busy={loading}>
              {error && <div id="signin-error" role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800"><AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{error}</span></div>}
              <div>
                <label htmlFor="email" className="label">Email address</label>
                <div className="relative">
                  <Mail size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id="email" name="email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" className="input signin-input pl-11" aria-describedby={error ? "signin-error" : undefined} disabled={loading} />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="password" className="text-xs font-semibold text-slate-700">Password</label>
                  <Link to="/forgot-password" className="signin-text-link">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id="password" name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" className="input signin-input pl-11 pr-12" aria-describedby={error ? "signin-error" : undefined} disabled={loading} />
                  <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-0.5 top-0.5 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-brand-50 hover:text-brand-700">
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary signin-submit w-full">
                {loading ? <><LoaderCircle size={17} className="motion-safe:animate-spin" aria-hidden="true" />Signing in…</> : <>Sign in to your academy<ArrowRight size={17} aria-hidden="true" /></>}
              </button>
            </form>
            <p className="mt-5 text-center text-xs leading-5 text-slate-600">New to Synergy Academy? <Link to="/signup" className="signin-text-link">Create an account</Link></p>
            {demoMode && <details className="signin-demo mt-6">
              <summary><span className="inline-flex items-center gap-2"><KeyRound size={15} aria-hidden="true" />Explore demo access</span></summary>
              <div className="px-3.5 pb-3.5">
                <p className="mb-3 text-xs leading-5 text-slate-600">Choose a workspace to fill in the form, then sign in.</p>
                <div className="flex flex-wrap gap-2">{demoAccounts.map(account => <button key={account.role} type="button" disabled={loading} onClick={() => { setEmail(account.email); setPassword(account.password); setShowPassword(false); setError(null); }} className="signin-demo-button">{account.role}<ArrowUpRight size={14} aria-hidden="true" /></button>)}</div>
              </div>
            </details>}
            <div className="signin-help">
              <p>Need a hand getting started?</p>
              <a href="mailto:info@synergybahamas.com" className="signin-text-link">Contact the Academy team <ArrowUpRight size={13} className="inline" aria-hidden="true" /></a>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1"><a href="tel:+12423230727">(242) 323-0727</a><a href="tel:+12426016016">(242) 601-6016</a></div>
            </div>
          </div>
          <p className="signin-copyright">© {new Date().getFullYear()} Synergy Bahamas. All rights reserved.</p>
        </section>
      </div>
    </main>
  );
}

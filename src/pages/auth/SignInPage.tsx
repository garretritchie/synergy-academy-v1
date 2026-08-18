import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 lg:grid lg:grid-cols-2">
      {/* Left panel — branding */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-12 lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-400/10 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-lg font-bold">Synergy Academy</p>
            <p className="text-sm text-brand-200">by Synergy Bahamas</p>
          </div>
        </div>

        <div className="relative z-10 text-white">
          <h1 className="text-4xl font-bold leading-tight">
            Learn smarter,<br />achieve more.
          </h1>
          <p className="mt-4 max-w-md text-brand-100">
            Instructor-led courses with live sessions, structured curriculum, and
            personalized academic records — all in one place.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-sm text-brand-200">
          <div>
            <p className="text-2xl font-bold text-white">5</p>
            <p>Categories</p>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div>
            <p className="text-2xl font-bold text-white">100%</p>
            <p>Mobile-ready</p>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div>
            <p className="text-2xl font-bold text-white">Live</p>
            <p>Classes</p>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
              <GraduationCap size={22} />
            </div>
            <div>
              <p className="text-base font-bold text-ink-900">Synergy Academy</p>
              <p className="text-xs text-ink-500">by Synergy Bahamas</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-ink-900">Welcome back</h2>
          <p className="mt-1.5 text-sm text-ink-500">Sign in to access your learning dashboard.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-danger-50 px-3.5 py-3 text-sm text-danger-700">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
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
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="input pl-10"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-brand-600 hover:text-brand-700">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

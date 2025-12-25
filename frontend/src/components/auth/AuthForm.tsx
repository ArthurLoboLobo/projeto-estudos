import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth';
import { LOGIN, REGISTER } from '../../lib/graphql/mutations';

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login: authLogin } = useAuth();

  const [loginMutation, { loading: loginLoading }] = useMutation(LOGIN);
  const [registerMutation, { loading: registerLoading }] = useMutation(REGISTER);

  const loading = loginLoading || registerLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const mutation = isLogin ? loginMutation : registerMutation;
      const { data } = await mutation({
        variables: { email, password },
      });

      const result = isLogin ? data.login : data.register;
      toast.success(isLogin ? 'Welcome back!' : 'Account created!');
      authLogin(result.token, result.user);
    } catch (err: any) {
      const message = err.message || 'An error occurred';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--caky-bg)] via-[var(--caky-bg-2)] to-[#1f2848]">
      <div className="w-full max-w-md p-8">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            📚 Caky
          </h1>
          <p className="text-[color:var(--caky-muted)]">
            AI-powered exam preparation
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-[color:var(--caky-surface)] backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-[color:var(--caky-border)]">
          <h2 className="text-2xl font-semibold text-white mb-6 text-center">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[color:var(--caky-muted)] mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-[color:var(--caky-border)] rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--caky-accent)] focus:border-transparent transition"
                placeholder="you@university.edu"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[color:var(--caky-muted)] mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-[color:var(--caky-border)] rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--caky-accent)] focus:border-transparent transition"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[var(--caky-primary)] text-white font-semibold rounded-xl hover:bg-[#334b80] focus:outline-none focus:ring-2 focus:ring-[color:var(--caky-accent)] focus:ring-offset-2 focus:ring-offset-[color:var(--caky-bg)] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-[color:var(--caky-muted)] hover:text-white transition"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[color:var(--caky-muted)]/70 text-sm mt-8">
          Upload your slides, past exams & notes — get personalized AI tutoring
        </p>
      </div>
    </div>
  );
}


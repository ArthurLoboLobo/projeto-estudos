import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth';
import { LOGIN, REGISTER } from '../../lib/graphql/mutations';
import ThemeToggle from '../ui/ThemeToggle';
import LanguageSwitcher from '../ui/LanguageSwitcher';

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login: authLogin } = useAuth();
  const { t } = useTranslation();

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedData = data as any;
      const result = isLogin ? typedData?.login : typedData?.register;
      if (result) {
        toast.success(isLogin ? t('auth.welcomeBack') : t('auth.accountCreated'));
        authLogin(result.token, result.user);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.genericError');
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-caky-bg relative overflow-hidden p-4">
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      {/* Decorative Background Elements */}
      <div className="absolute -top-40 -right-40 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-caky-secondary/20 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
      <div className="absolute top-20 -left-20 w-64 md:w-96 h-64 md:h-96 bg-caky-primary/5 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Brand */}
        <div className="text-center mb-6 md:mb-8">
          <img src="/caky_logo.png" alt="Caky Logo" className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 drop-shadow-md" />
          <h1 className="text-3xl md:text-4xl font-bold text-caky-primary mb-2">
            {t('auth.title')}
          </h1>
          <p className="text-caky-text/70 font-medium text-sm md:text-base">
            {t('auth.subtitle')}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-caky-secondary/30">
          <h2 className="text-xl md:text-2xl font-bold text-caky-text mb-6 text-center">
            {isLogin ? t('auth.welcome') : t('auth.createAccount')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            <div>
              <label className="block text-sm font-semibold text-caky-text mb-2">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-caky-card border border-gray-200 dark:border-gray-600 rounded-xl text-caky-text placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary transition"
                placeholder={t('auth.emailPlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-caky-text mb-2">
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-caky-card border border-gray-200 dark:border-gray-600 rounded-xl text-caky-text placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary transition"
                placeholder={t('auth.passwordPlaceholder')}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-caky-primary text-white font-bold rounded-xl hover:bg-caky-dark focus:outline-none focus:ring-2 focus:ring-caky-primary focus:ring-offset-2 focus:ring-offset-white transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('auth.processing')}
                </span>
              ) : (
                isLogin ? t('auth.login') : t('auth.register')
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-caky-primary hover:text-caky-text font-medium transition underline-offset-4 hover:underline text-sm md:text-base p-2 active:bg-caky-secondary/10 rounded-lg"
            >
              {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-caky-text/50 text-xs md:text-sm mt-8 font-medium px-4">
          {t('auth.footer')}
        </p>
      </div>
    </div>
  );
}
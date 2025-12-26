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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedData = data as any;
      const result = isLogin ? typedData?.login : typedData?.register;
      if (result) {
        toast.success(isLogin ? 'Welcome back!' : 'Account created!');
        authLogin(result.token, result.user);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-caky-bg relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-caky-secondary/20 rounded-full blur-3xl opacity-60"></div>
      <div className="absolute top-20 -left-20 w-96 h-96 bg-caky-primary/5 rounded-full blur-3xl opacity-60"></div>

      <div className="w-full max-w-md p-6 relative z-10">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <img src="/caky_logo.png" alt="Caky Logo" className="w-20 h-20 mx-auto mb-4 drop-shadow-md" />
          <h1 className="text-4xl font-bold text-caky-primary mb-2">
            Caky
          </h1>
          <p className="text-caky-dark/70 font-medium">
            Preparação para provas com IA
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-caky-secondary/30">
          <h2 className="text-2xl font-bold text-caky-dark mb-6 text-center">
            {isLogin ? 'Bem-vindo de Volta' : 'Criar Conta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-caky-dark mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-caky-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary transition"
                placeholder="voce@universidade.edu.br"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-caky-dark mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-caky-dark placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-caky-primary/50 focus:border-caky-primary transition"
                placeholder="••••••••"
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
                  Processando...
                </span>
              ) : (
                isLogin ? 'Entrar' : 'Criar Conta'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-caky-primary hover:text-caky-dark font-medium transition underline-offset-4 hover:underline"
            >
              {isLogin
                ? "Não tem uma conta? Cadastre-se"
                : 'Já tem uma conta? Entrar'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-caky-dark/50 text-sm mt-8 font-medium">
          Faça upload dos seus slides, provas antigas e anotações — obtenha tutoria personalizada de IA
        </p>
      </div>
    </div>
  );
}

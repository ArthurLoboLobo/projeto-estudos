import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import ThemeToggle from '../components/ui/ThemeToggle';

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-caky-bg text-caky-text font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 p-4 md:p-6 z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <img src="/caky_logo.png" alt="Caky Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain" />
            <h1 className="text-2xl md:text-3xl font-bold text-caky-primary tracking-tight">Caky</h1>
          </Link>
          <div className="flex items-center gap-2 md:gap-4">
            <ThemeToggle />
            <Link
              to={isAuthenticated ? '/dashboard' : '/auth'}
              className="px-4 md:px-6 py-2 bg-caky-card text-caky-primary text-sm md:text-base font-semibold rounded-full border-2 border-caky-primary hover:bg-caky-primary hover:text-white transition shadow-sm active:scale-95"
            >
              {isAuthenticated ? 'Painel' : 'Começar'}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-4 md:px-6 relative overflow-hidden pt-20 md:pt-0">
         {/* Decorative Background Elements */}
         <div className="absolute -top-20 -right-20 w-64 md:w-96 h-64 md:h-96 bg-caky-secondary/30 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
         <div className="absolute top-40 -left-20 w-48 md:w-72 h-48 md:h-72 bg-caky-primary/10 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10 pt-10 md:pt-20">
          <div className="mb-6 md:mb-8">
            <img src="/caky_logo.png" alt="Caky Logo" className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 drop-shadow-lg" />
            <span className="inline-block px-3 py-1 md:px-4 md:py-2 bg-caky-secondary/20 text-caky-primary rounded-full text-xs md:text-sm font-bold border border-caky-secondary/50 mb-4 md:mb-6 tracking-wide">
              ✨ Assistente de Estudos com IA
            </span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold text-caky-text mb-4 md:mb-6 leading-tight tracking-tight">
            Estudar com {' '}
            <span className="text-caky-primary underline decoration-caky-secondary/50 decoration-4 underline-offset-4">
              IA
            </span> nunca foi tão fácil
          </h1>

          <p className="text-lg md:text-xl text-caky-text/70 mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed font-medium px-2">
            Diferente dos tutores genéricos, o Caky conhece exatamente seu conteúdo. Faça upload dos seus materiais e tenha um assistente personalizado que gera planos de estudos inteligentes.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center px-4">
            <Link
              to="/auth"
              className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-caky-primary text-white font-bold rounded-xl hover:bg-caky-dark transition shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:scale-95 text-center"
            >
              Começar a Estudar Grátis →
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-transparent text-caky-primary font-bold rounded-xl hover:bg-caky-primary/5 transition border-2 border-caky-primary/20 active:scale-95 text-center"
            >
              Ver Como Funciona
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 md:py-24 px-4 md:px-6 bg-caky-secondary/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-caky-text text-center mb-10 md:mb-16">
            Como Funciona
          </h2>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                step: '01',
                title: 'Envie Seus Materiais',
                description: 'Faça upload de slides e provas antigas. Nossa IA processa tudo, incluindo fórmulas e imagens.',
              },
              {
                step: '02',
                title: 'Receba seu Plano',
                description: 'Obtenha um roteiro de estudos focado no que realmente cai na prova, organizado por prioridade.',
              },
              {
                step: '03',
                title: 'Estude e Domine',
                description: 'Tire dúvidas e faça exercícios com um tutor que domina o conteúdo da sua disciplina.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-caky-bg rounded-2xl p-6 md:p-8 border border-caky-secondary/30 hover:border-caky-primary/50 transition group hover:shadow-md"
              >
                <div className="text-caky-primary font-bold font-mono text-sm mb-2 uppercase tracking-wider">
                  Passo {item.step}
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-caky-text mb-2 md:mb-3">
                  {item.title}
                </h3>
                <p className="text-caky-text/70 leading-relaxed text-sm md:text-base">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 md:mt-16 text-center max-w-3xl mx-auto">
            <Link
              to="/auth"
              className="inline-block w-full sm:w-auto px-8 md:px-10 py-3 md:py-4 bg-caky-primary text-white font-bold rounded-xl hover:bg-caky-dark transition shadow-lg hover:shadow-xl text-base md:text-lg transform hover:-translate-y-1 active:scale-95"
            >
              Criar Conta Gratuita
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-caky-text/10 py-8 md:py-12 px-4 md:px-6 bg-caky-card">
        <div className="max-w-6xl mx-auto text-center">
          <img src="/caky_logo.png" alt="Caky Logo" className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition" />
          <div className="text-caky-text/50 text-xs md:text-sm font-medium space-y-1">
            <div>© 2025 Caky. Built by <a href="https://twitter.com/ArthurLoboLC" target="_blank" rel="noopener noreferrer" className="hover:text-caky-primary transition-colors">@ArthurLoboLC</a></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
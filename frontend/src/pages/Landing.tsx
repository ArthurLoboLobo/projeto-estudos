import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-caky-bg text-caky-dark font-sans">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 p-6 z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold text-caky-primary tracking-tight">📚 Caky</h1>
          <Link
            to={isAuthenticated ? '/dashboard' : '/auth'}
            className="px-6 py-2 bg-white text-caky-primary font-semibold rounded-full border-2 border-caky-primary hover:bg-caky-primary hover:text-white transition shadow-sm"
          >
            {isAuthenticated ? 'Dashboard' : 'Get Started'}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
         {/* Decorative Background Elements */}
         <div className="absolute -top-20 -right-20 w-96 h-96 bg-caky-secondary/30 rounded-full blur-3xl opacity-50"></div>
         <div className="absolute top-40 -left-20 w-72 h-72 bg-caky-primary/10 rounded-full blur-3xl opacity-50"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10 pt-20">
          <div className="mb-8">
            <span className="inline-block px-4 py-2 bg-caky-secondary/20 text-caky-primary rounded-full text-sm font-bold border border-caky-secondary/50 mb-6 tracking-wide">
              ✨ AI-Powered Study Assistant
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold text-caky-dark mb-6 leading-tight tracking-tight">
            Ace Your Exams with{' '}
            <span className="text-caky-primary underline decoration-caky-secondary/50 decoration-4 underline-offset-4">
              Hyper-Focused
            </span>{' '}
            Study
          </h1>
          
          <p className="text-xl text-caky-dark/70 mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
            Upload your slides, past exams, and notes. Get a personalized AI tutor that
            knows exactly what you need to study for your specific course.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth"
              className="px-8 py-4 bg-caky-primary text-white font-bold rounded-xl hover:bg-caky-dark transition shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Start Studying Free →
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 bg-transparent text-caky-primary font-bold rounded-xl hover:bg-caky-primary/5 transition border-2 border-caky-primary/20"
            >
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-caky-dark text-center mb-16">
            How It Works
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Materials',
                description: 'Drop your slides, past exams, lecture notes, and textbook PDFs into your study session.',
                icon: '📄',
              },
              {
                step: '02',
                title: 'AI Reads Everything',
                description: 'Our AI uses vision technology to extract text, formulas, and diagrams with perfect accuracy.',
                icon: '🤖',
              },
              {
                step: '03',
                title: 'Study Smarter',
                description: 'Ask questions, get explanations, practice problems — all based on YOUR specific materials.',
                icon: '🎯',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-caky-bg rounded-2xl p-8 border border-caky-secondary/30 hover:border-caky-primary/50 transition group hover:shadow-md"
              >
                <span className="text-5xl mb-6 block opacity-90">{item.icon}</span>
                <div className="text-caky-primary font-bold font-mono text-sm mb-2 uppercase tracking-wider">
                  Step {item.step}
                </div>
                <h3 className="text-2xl font-bold text-caky-dark mb-3">
                  {item.title}
                </h3>
                <p className="text-caky-dark/70 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-caky-secondary/10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-caky-dark text-center mb-4">
            Why Caky?
          </h2>
          <p className="text-caky-dark/60 text-center mb-16 max-w-2xl mx-auto font-medium">
            Unlike generic AI tutors, Caky focuses on YOUR specific course materials
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Formula-Aware OCR',
                description: 'Using vision AI, we accurately extract LaTeX formulas from your PDFs — no more mangled equations.',
                icon: '📐',
              },
              {
                title: 'Context-Aware Responses',
                description: 'Every answer is grounded in your uploaded materials. No hallucinations, just relevant help.',
                icon: '🎯',
              },
              {
                title: 'Session-Based Learning',
                description: 'Organize by course or exam. Each session remembers your docs and conversation history.',
                icon: '📁',
              },
              {
                title: 'Powered by Gemini 2.5',
                description: "Using Google's latest AI model via OpenRouter for fast, accurate, and affordable responses.",
                icon: '⚡',
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="flex gap-4 p-6 bg-white rounded-xl border border-caky-secondary/20 shadow-sm hover:shadow-md transition"
              >
                <span className="text-3xl text-caky-primary">{feature.icon}</span>
                <div>
                  <h3 className="text-xl font-bold text-caky-dark mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-caky-dark/70 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-caky-dark mb-6">
            Ready to Study Smarter?
          </h2>
          <p className="text-xl text-caky-dark/70 mb-10">
            Join students who are acing their exams with personalized AI tutoring.
          </p>
          <Link
            to="/auth"
            className="inline-block px-10 py-4 bg-caky-primary text-white font-bold rounded-xl hover:bg-caky-dark transition shadow-lg hover:shadow-xl text-lg transform hover:-translate-y-1"
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-caky-dark/10 py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto text-center text-caky-dark/50 text-sm font-medium">
          © 2024 Caky. Built with React, Rust, and ❤️
        </div>
      </footer>
    </div>
  );
}

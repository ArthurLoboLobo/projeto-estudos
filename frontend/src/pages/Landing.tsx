import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--caky-bg)] via-[var(--caky-bg-2)] to-[#1f2848]">
      {/* Navigation */}
      <nav className="absolute top-0 left-0 right-0 p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">📚 Caky</h1>
          <Link
            to={isAuthenticated ? '/dashboard' : '/auth'}
            className="px-6 py-2 bg-white/10 hover:bg-white/15 text-white rounded-full border border-[color:var(--caky-border)] transition"
          >
            {isAuthenticated ? 'Dashboard' : 'Get Started'}
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <span className="inline-block px-4 py-2 bg-[color:rgba(172,217,232,0.12)] text-[color:var(--caky-accent)] rounded-full text-sm font-medium border border-[color:var(--caky-border)] mb-6">
              ✨ AI-Powered Study Assistant
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Ace Your Exams with{' '}
            <span className="bg-gradient-to-r from-[var(--caky-accent)] to-white bg-clip-text text-transparent">
              Hyper-Focused
            </span>{' '}
            Study
          </h1>
          
          <p className="text-xl text-[color:var(--caky-muted)] mb-10 max-w-2xl mx-auto leading-relaxed">
            Upload your slides, past exams, and notes. Get a personalized AI tutor that
            knows exactly what you need to study for your specific course.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/auth"
              className="px-8 py-4 bg-[var(--caky-primary)] text-white font-semibold rounded-xl hover:bg-[#334b80] transition shadow-lg shadow-black/25"
            >
              Start Studying Free →
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/15 transition border border-[color:var(--caky-border)]"
            >
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-16">
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
                className="bg-[color:var(--caky-surface)] backdrop-blur-sm rounded-2xl p-8 border border-[color:var(--caky-border)] hover:border-[color:rgba(172,217,232,0.35)] transition group"
              >
                <span className="text-6xl mb-6 block">{item.icon}</span>
                <div className="text-[color:var(--caky-accent)] font-mono text-sm mb-2">
                  Step {item.step}
                </div>
                <h3 className="text-2xl font-semibold text-white mb-3">
                  {item.title}
                </h3>
                <p className="text-[color:var(--caky-muted)] leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-[color:rgba(0,0,0,0.18)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-4">
            Why Caky?
          </h2>
          <p className="text-[color:var(--caky-muted)] text-center mb-16 max-w-2xl mx-auto">
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
                className="flex gap-4 p-6 bg-[color:var(--caky-surface)] rounded-xl border border-[color:var(--caky-border)]"
              >
                <span className="text-3xl">{feature.icon}</span>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-[color:var(--caky-muted)]">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Study Smarter?
          </h2>
          <p className="text-xl text-[color:var(--caky-muted)] mb-10">
            Join students who are acing their exams with personalized AI tutoring.
          </p>
          <Link
            to="/auth"
            className="inline-block px-10 py-4 bg-[var(--caky-primary)] text-white font-semibold rounded-xl hover:bg-[#334b80] transition shadow-lg shadow-black/25 text-lg"
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto text-center text-[color:var(--caky-muted)]/60 text-sm">
          © 2024 Caky. Built with React and Rust.
        </div>
      </footer>
    </div>
  );
}

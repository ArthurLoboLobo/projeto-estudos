import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ui/ThemeToggle';
import LanguageSwitcher from './ui/LanguageSwitcher';

interface HeaderProps {
  sessionTitle?: string;
  showBackButton?: boolean;
}

export default function Header({ sessionTitle, showBackButton = false }: HeaderProps) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-caky-text/10 bg-caky-card/80 backdrop-blur-md shadow-sm h-16">
      <div className="max-w-6xl mx-auto px-6 md:px-8 h-full flex items-center justify-between relative">
        {/* Left Section */}
        <div className="flex items-center gap-4 shrink-0">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="/caky_logo.png" alt="Caky Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold text-caky-primary">Caky</span>
          </Link>

          {showBackButton && (
            <div className="flex items-center gap-4 ml-2 md:ml-4">
              <div className="h-6 w-px bg-caky-text/10 hidden md:block" />
              <Link 
                to="/dashboard" 
                className="flex items-center gap-2 text-caky-text/70 hover:text-caky-primary transition-colors text-sm font-medium"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden md:inline">{t('header.dashboard')}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Center Section - Session Title */}
        {sessionTitle && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[40%] hidden md:flex justify-center pointer-events-none">
            <h1 className="text-lg font-bold text-caky-text truncate pointer-events-auto">
              {sessionTitle}
            </h1>
          </div>
        )}

        {/* Right Section */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          
          {user && (
            <div className="flex items-center gap-3 md:gap-4">
              <span className="text-caky-text/70 text-sm font-medium hidden md:block">
                {user.email}
              </span>
              <button
                onClick={logout}
                className="px-3 md:px-4 py-2 text-sm text-caky-primary hover:bg-caky-primary/10 rounded-lg transition font-medium active:scale-95"
              >
                {t('common.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

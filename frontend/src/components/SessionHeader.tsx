import { Link } from 'react-router-dom';
import ThemeToggle from './ui/ThemeToggle';
import type { Session } from '../types';

interface SessionHeaderProps {
  session: Session;
  user: { email: string } | null;
  onLogout: () => void;
  showEmail?: boolean;
  maxWidth?: string;
  extraActions?: React.ReactNode;
  isMobile?: boolean;
  hideLogoOnMobile?: boolean;
  customTitleSize?: string;
}

export default function SessionHeader({
  session,
  user,
  onLogout,
  showEmail = true,
  maxWidth,
  extraActions,
  isMobile = false,
  hideLogoOnMobile = false,
  customTitleSize
}: SessionHeaderProps) {
  const headerContent = (
    <div className={`${isMobile ? 'px-4 py-3' : 'px-4 md:px-6 py-4'} flex justify-between items-center`}>
      <div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-2 md:gap-4'} min-w-0`}>
        <Link
          to="/dashboard"
          className="text-caky-primary hover:text-caky-text transition shrink-0 font-medium"
        >
          ← Voltar
        </Link>
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/caky_logo.png"
            alt="Caky Logo"
            className={`w-6 h-6 object-contain ${hideLogoOnMobile ? 'hidden md:block' : ''}`}
          />
          <div className="min-w-0">
            <h1 className={`${customTitleSize || (isMobile ? 'text-base' : 'text-lg md:text-xl')} font-bold text-caky-text truncate`}>
              {session.title}
            </h1>
            {session.description && (
              <p className="text-sm text-caky-text/50 truncate hidden md:block">{session.description}</p>
            )}
          </div>
        </div>
      </div>
      <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-2 md:gap-4'} shrink-0`}>
        {extraActions}
        <ThemeToggle />
        {showEmail && user?.email && (
          <span className="text-caky-text/70 text-sm hidden md:block font-medium">{user.email}</span>
        )}
        <button
          onClick={onLogout}
          className="px-3 md:px-4 py-2 text-sm text-caky-primary hover:bg-caky-primary/10 rounded-lg transition font-medium active:scale-95"
        >
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <header className="border-b border-caky-text/10 bg-caky-card/80 backdrop-blur-md shadow-sm shrink-0 z-10 sticky top-0">
      {maxWidth ? (
        <div className={`max-w-${maxWidth} mx-auto`}>
          {headerContent}
        </div>
      ) : (
        headerContent
      )}
    </header>
  );
}

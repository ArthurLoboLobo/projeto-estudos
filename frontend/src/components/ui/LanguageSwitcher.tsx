import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Translate Icon Component (matching the user's image)
function TranslateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

// Chevron Down Icon
function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// Brazilian Flag SVG Component
function BrazilFlag() {
  return (
    <svg viewBox="0 0 36 36" className="w-5 h-5">
      <path fill="#2D3A64" d="M0 0h36v36H0z"/>
      <path fill="#ACD9E8" d="M18 3.5 32.5 18 18 32.5 3.5 18z"/>
      <circle fill="#3C5489" cx="18" cy="18" r="6.5"/>
      <path fill="#DBEAFE" d="M12 17.5a6.5 6.5 0 0 0 11.6 4 7 7 0 0 1-10.5-4.8 6.5 6.5 0 0 0-1.1.8z"/>
    </svg>
  );
}

// USA Flag SVG Component
function USAFlag() {
  return (
    <svg viewBox="0 0 36 36" className="w-5 h-5">
      <path fill="#2D3A64" d="M0 0h36v36H0z"/>
      <path d="M0 3h36v3H0zm0 6h36v3H0zm0 6h36v3H0zm0 6h36v3H0zm0 6h36v3H0zm0 6h36v3H0z" fill="#ACD9E8"/>
      <path fill="#3C5489" d="M0 0h14.4v18H0z"/>
      <g fill="#DBEAFE">
        <circle cx="2.4" cy="2.4" r=".8"/>
        <circle cx="6" cy="2.4" r=".8"/>
        <circle cx="9.6" cy="2.4" r=".8"/>
        <circle cx="4.2" cy="4.8" r=".8"/>
        <circle cx="7.8" cy="4.8" r=".8"/>
        <circle cx="11.4" cy="4.8" r=".8"/>
        <circle cx="2.4" cy="7.2" r=".8"/>
        <circle cx="6" cy="7.2" r=".8"/>
        <circle cx="9.6" cy="7.2" r=".8"/>
        <circle cx="4.2" cy="9.6" r=".8"/>
        <circle cx="7.8" cy="9.6" r=".8"/>
        <circle cx="11.4" cy="9.6" r=".8"/>
        <circle cx="2.4" cy="12" r=".8"/>
        <circle cx="6" cy="12" r=".8"/>
        <circle cx="9.6" cy="12" r=".8"/>
        <circle cx="4.2" cy="14.4" r=".8"/>
        <circle cx="7.8" cy="14.4" r=".8"/>
        <circle cx="11.4" cy="14.4" r=".8"/>
      </g>
    </svg>
  );
}

const languages = [
  { code: 'pt', name: 'Português', flag: <BrazilFlag /> },
  { code: 'en', name: 'English', flag: <USAFlag /> },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];
  const otherLanguages = languages.filter(lang => lang.code !== i18n.language);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('language', code);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all active:scale-95 ${
          isOpen ? 'bg-caky-primary/10 text-caky-primary' : 'text-caky-text/70 hover:text-caky-primary hover:bg-caky-primary/5'
        }`}
        title={i18n.language === 'pt' ? 'Mudar idioma' : 'Change language'}
      >
        <TranslateIcon />
        <div className="flex items-center gap-1">
          <span className="text-sm font-bold uppercase tracking-wider">{currentLanguage.code}</span>
          <ChevronDownIcon />
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-40 bg-caky-card border border-caky-text/10 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="py-1">
            {otherLanguages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => selectLanguage(lang.code)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium text-caky-text hover:bg-caky-primary/10 hover:text-caky-primary transition-colors"
              >
                {lang.flag}
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ptTranslations from './locales/pt.json';
import enTranslations from './locales/en.json';

const resources = {
  pt: {
    translation: ptTranslations,
  },
  en: {
    translation: enTranslations,
  },
};

// Get language from localStorage or default to Portuguese
const savedLanguage = localStorage.getItem('language') || 'pt';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage,
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false, // React already handles escaping
    },
  });

export default i18n;

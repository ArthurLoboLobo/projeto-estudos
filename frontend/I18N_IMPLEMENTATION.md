# Internationalization (i18n) Implementation

## Overview
This project now supports both **Portuguese (pt)** and **English (en)** languages. Users can switch between languages using the flag icons in the header.

## Features Implemented

### 1. Language Switcher Component
- Location: `src/components/ui/LanguageSwitcher.tsx`
- Brazilian flag 🇧🇷 for Portuguese
- American flag 🇺🇸 for English
- Click to toggle between languages
- Language preference is saved to localStorage

### 2. Translation Files
- **Portuguese**: `src/i18n/locales/pt.json`
- **English**: `src/i18n/locales/en.json`

### 3. i18n Configuration
- Location: `src/i18n/config.ts`
- Uses `i18next` and `react-i18next`
- Automatically loads saved language preference from localStorage
- Falls back to Portuguese if no preference is set

### 4. Updated Components
All components and pages now support translations:
- ✅ Landing page
- ✅ Auth/Login page
- ✅ Dashboard page
- ✅ Session page (study interface)
- ✅ Header component
- ✅ All modals and forms
- ✅ Toast notifications
- ✅ Error messages

## Usage

### For Users
1. Look for the flag icon in the header
2. Click on it to switch languages
3. The language preference is automatically saved

### For Developers

#### Adding New Translations
1. Add the translation key to both `pt.json` and `en.json` files
2. Use the `useTranslation` hook in your component:

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('mySection.title')}</h1>
      <p>{t('mySection.description')}</p>
    </div>
  );
}
```

#### Translation with Variables
```typescript
// In JSON file:
{
  "greeting": "Hello, {name}!"
}

// In component:
t('greeting', { name: 'Arthur' })
// Output: "Hello, Arthur!"
```

## File Structure
```
frontend/
├── src/
│   ├── i18n/
│   │   ├── config.ts          # i18n configuration
│   │   └── locales/
│   │       ├── pt.json        # Portuguese translations
│   │       └── en.json        # English translations
│   ├── components/
│   │   └── ui/
│   │       └── LanguageSwitcher.tsx  # Language switcher component
│   └── ...
```

## Libraries Used
- **i18next**: Core internationalization framework
- **react-i18next**: React bindings for i18next

## Implementation Notes
- The default language is Portuguese (pt)
- Language preference persists across sessions via localStorage
- All user-facing text has been internationalized
- The language switcher appears in:
  - Landing page navigation
  - Auth page (top right)
  - Main application header

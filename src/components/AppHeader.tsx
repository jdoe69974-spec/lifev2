import { Moon, Sun, Globe } from 'lucide-react';
import { Language, t } from '@/lib/translations';

interface AppHeaderProps {
  lang: Language;
  dark: boolean;
  onToggleLang: () => void;
  onToggleDark: () => void;
}

export function AppHeader({ lang, dark, onToggleLang, onToggleDark }: AppHeaderProps) {
  return (
    <header className="mb-8 border-b border-primary/30 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
          {t(lang, 'appTitle')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{t(lang, 'appSubtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:opacity-80 transition-opacity"
        >
          <Globe className="w-4 h-4" />
          {lang === 'en' ? t(lang, 'spanish') : t(lang, 'english')}
        </button>
        <button
          onClick={onToggleDark}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:opacity-80 transition-opacity"
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {dark ? t(lang, 'lightMode') : t(lang, 'darkMode')}
        </button>
      </div>
    </header>
  );
}

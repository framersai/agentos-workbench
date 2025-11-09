import { Sun, Moon } from 'lucide-react';
import { useThemeStore, Theme } from '../state/themeStore';

export function ThemeToggle() {
  const { actualTheme, setTheme } = useThemeStore();

  const isDark = actualTheme === 'dark';
  const nextTheme: Theme = isDark ? 'light' : 'dark';

  const handleToggle = () => {
    // If user previously chose system, flip based on actual and persist explicit choice
    setTheme(nextTheme);
  };

  return (
    <button
      onClick={handleToggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/70 text-slate-800 shadow-sm backdrop-blur transition hover:bg-slate-200/70 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:bg-white/10 dark:focus:ring-offset-slate-900"
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, Theme } from '../state/themeStore';

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const themes: Array<{ value: Theme; icon: React.ReactNode; label: string }> = [
    { value: 'light', icon: <Sun className="w-4 h-4" />, label: 'Light' },
    { value: 'dark', icon: <Moon className="w-4 h-4" />, label: 'Dark' },
    { value: 'system', icon: <Monitor className="w-4 h-4" />, label: 'System' },
  ];

  return (
    <div 
      className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-1 shadow-sm dark:border-gray-600 dark:bg-gray-800"
      role="radiogroup"
      aria-label="Theme preference"
    >
      {themes.map(({ value, icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          role="radio"
          aria-checked={theme === value}
          className={`
            inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
            transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800
            ${
              theme === value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }
          `}
          title={`Switch to ${label.toLowerCase()} theme`}
          aria-label={`${label} theme`}
        >
          <span aria-hidden="true">{icon}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

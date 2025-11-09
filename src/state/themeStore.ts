import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (theme: 'light' | 'dark') => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
  
  // Update meta theme-color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#1a1a1a' : '#ffffff');
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      actualTheme: getSystemTheme(),
      
      setTheme: (theme: Theme) => {
        const actualTheme = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(actualTheme);
        set({ theme, actualTheme });
      },
    }),
    {
      name: 'agentos-theme-preference',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const actualTheme = state.theme === 'system' ? getSystemTheme() : state.theme;
          applyTheme(actualTheme);
          state.actualTheme = actualTheme;
        }
      },
    }
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = () => {
    const store = useThemeStore.getState();
    if (store.theme === 'system') {
      const actualTheme = getSystemTheme();
      applyTheme(actualTheme);
      useThemeStore.setState({ actualTheme });
    }
  };
  
  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', listener);
  } else {
    // Fallback for older browsers
    mediaQuery.addListener(listener);
  }
}

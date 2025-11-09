import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type Appearance = 'default' | 'compact' | 'contrast';
export type Palette = 'default' | 'sakura' | 'sunset' | 'twilight' | 'aurora' | 'warm' | 'terminus-amber' | 'terminus-green' | 'terminus-white';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
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

const applyAppearance = (appearance: Appearance) => {
  const root = document.documentElement;
  root.classList.remove('appearance-default', 'appearance-compact', 'appearance-contrast');
  root.classList.add(`appearance-${appearance}`);
};

const applyPalette = (palette: Palette) => {
  const root = document.documentElement;
  root.classList.remove('palette-default', 'palette-sakura', 'palette-sunset');
  root.classList.add(`palette-${palette}`);
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      actualTheme: getSystemTheme(),
      appearance: 'default',
      palette: 'default',
      
      setTheme: (theme: Theme) => {
        const actualTheme = theme === 'system' ? getSystemTheme() : theme;
        applyTheme(actualTheme);
        set({ theme, actualTheme });
      },
      setAppearance: (appearance: Appearance) => {
        applyAppearance(appearance);
        set({ appearance });
      },
      setPalette: (palette: Palette) => {
        applyPalette(palette);
        set({ palette });
      },
    }),
    {
      name: 'agentos-theme-preference',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const actualTheme = state.theme === 'system' ? getSystemTheme() : state.theme;
          applyTheme(actualTheme);
          state.actualTheme = actualTheme;
          applyAppearance(state.appearance ?? 'default');
          applyPalette(state.palette ?? 'default');
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

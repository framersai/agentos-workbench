import { useEffect } from "react";

export function useSystemTheme() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = (isDark: boolean) => {
      root.classList.toggle("dark", isDark);
      root.classList.toggle("light", !isDark);
    };

    applyTheme(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => applyTheme(event.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
      return () => mediaQuery.removeEventListener("change", listener);
    }

    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, []);
}

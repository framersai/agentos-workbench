import { useState } from "react";
import { useThemeStore, type Theme, type Appearance, type Palette } from "../state/themeStore";

export function ThemePanel() {
  const { theme, setTheme, actualTheme, appearance, setAppearance, palette, setPalette } = useThemeStore();
  const [open, setOpen] = useState(true);

  const themes: Array<{ key: Theme; label: string }> = [
    { key: "light", label: "Light" },
    { key: "dark", label: "Dark" },
    { key: "system", label: "System" },
  ];

  const appearances: Array<{ key: Appearance; label: string; hint: string }> = [
    { key: "default", label: "Default", hint: "Balanced spacing and borders" },
    { key: "compact", label: "Compact", hint: "Tighter spacing for dense views" },
    { key: "contrast", label: "High contrast", hint: "Stronger borders and text" },
  ];

  const palettes: Array<{ key: Palette; label: string }> = [
    { key: "default", label: "Default" },
    { key: "sakura", label: "Sakura Sunset" },
    { key: "twilight", label: "Twilight Neo" },
    { key: "aurora", label: "Aurora Daybreak" },
    { key: "warm", label: "Warm Embrace" },
    { key: "terminus-amber", label: "Terminus (Amber)" },
    { key: "terminus-green", label: "Terminus (Green)" },
    { key: "terminus-white", label: "Terminus (White)" },
    { key: "sunset", label: "Sunset (legacy)" },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900/60">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Theme</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Display preferences</h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300"
        >
          {open ? "Hide" : "Show"}
        </button>
      </header>

      {open && (
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Mode</p>
            <div className="flex flex-wrap gap-2">
              {themes.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTheme(opt.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    theme === opt.key
                      ? "border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-500/60 dark:bg-sky-500/10 dark:text-sky-200"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Active: {actualTheme}</p>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Appearance</p>
            <div className="flex flex-wrap gap-2">
              {appearances.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setAppearance(opt.key)}
                  title={opt.hint}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    appearance === opt.key
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400">Style</p>
            <div className="flex flex-wrap gap-2">
              {palettes.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPalette(opt.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    palette === opt.key
                      ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/60 dark:bg-fuchsia-500/10 dark:text-fuchsia-200"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Changes accent colors to match landing page themes.</p>
          </div>
        </div>
      )}
    </section>
  );
}

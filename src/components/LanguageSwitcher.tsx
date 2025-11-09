import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const SUPPORTED_LANGUAGES = ["en", "es"] as const;

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const currentLanguage = i18n.resolvedLanguage ?? i18n.language ?? "en";

  const options = useMemo(
    () =>
      SUPPORTED_LANGUAGES.map((code) => ({
        code,
        label: t(`languageSwitcher.languages.${code}`)
      })),
    [t]
  );

  return (
    <label className="inline-flex items-center gap-2 text-xs text-slate-400">
      <span className="sr-only">{t("languageSwitcher.label")}</span>
      <select
        value={currentLanguage}
        onChange={(event) => {
          const nextLanguage = event.target.value;
          void i18n.changeLanguage(nextLanguage);
        }}
        className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:border-white/20 focus:border-sky-500 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

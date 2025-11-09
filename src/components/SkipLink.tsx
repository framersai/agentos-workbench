import { useTranslation } from 'react-i18next';

/**
 * Skip Link Component
 * Provides keyboard-only users a way to skip repetitive navigation
 * and jump directly to main content
 */
export function SkipLink() {
  const { t } = useTranslation();

  return (
    <a
      href="#main-content"
      className="
        sr-only
        focus:not-sr-only
        focus:absolute
        focus:top-4
        focus:left-4
        focus:z-50
        focus:inline-block
        focus:rounded-lg
        focus:bg-sky-600
        focus:px-4
        focus:py-2
        focus:text-sm
        focus:font-semibold
        focus:text-white
        focus:shadow-lg
        focus:outline-none
        focus:ring-2
        focus:ring-sky-500
        focus:ring-offset-2
        dark:focus:ring-offset-slate-950
      "
    >
      {t('accessibility.skipToMain', { defaultValue: 'Skip to main content' })}
    </a>
  );
}

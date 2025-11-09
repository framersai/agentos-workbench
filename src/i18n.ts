import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "@/locales/en/common.json";
import esCommon from "@/locales/es/common.json";

const resources = {
  en: {
    common: enCommon
  },
  es: {
    common: esCommon
  }
} as const;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: Object.keys(resources),
    defaultNS: "common",
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ["localStorage", "querystring", "navigator", "htmlTag"],
      caches: ["localStorage"]
    },
    react: {
      useSuspense: false
    },
    debug: import.meta.env.DEV && import.meta.env.VITE_I18N_DEBUG === "true"
  });

export default i18n;

export type AppLocale = "es" | "en";

const STORAGE_KEY = "pf-ia-locale";

let activeLocale: AppLocale = "es";

export function getStoredLocale(): AppLocale {
  if (typeof localStorage === "undefined") return "es";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "en" ? "en" : "es";
}

export function setStoredLocale(locale: AppLocale): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, locale);
  }
}

export function getActiveLocale(): AppLocale {
  return activeLocale;
}

export function setActiveLocale(locale: AppLocale): void {
  activeLocale = locale;
  setStoredLocale(locale);
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export function initLocale(): AppLocale {
  const locale = getStoredLocale();
  setActiveLocale(locale);
  return locale;
}

export function speechLang(locale: AppLocale = activeLocale): string {
  return locale === "en" ? "en-US" : "es-MX";
}

export function whisperLang(locale: AppLocale = activeLocale): string {
  return locale === "en" ? "en" : "es";
}

export function wakePhrase(locale: AppLocale = activeLocale): string {
  return locale === "en" ? "hey coach" : "oye entrenador";
}

export function localeBase(locale: AppLocale = activeLocale): string {
  return `/locales/${locale}`;
}

export function localeContentUrl(
  locale: AppLocale,
  relativePath: string,
): string {
  const rel = relativePath.replace(/^\/+/, "");
  return `${localeBase(locale)}/${rel}`;
}

import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('NEXT_LOCALE')?.value ?? '';

  let locale: Locale;

  if ((locales as readonly string[]).includes(raw)) {
    locale = raw as Locale;
  } else {
    // Fallback to Accept-Language header
    const headerStore = await headers();
    const acceptLang = headerStore.get('accept-language') ?? '';
    const preferred = acceptLang.split(',').map(l => l.split(';')[0].trim().slice(0, 2).toLowerCase());
    const match = preferred.find(l => (locales as readonly string[]).includes(l));
    locale = (match as Locale) ?? defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

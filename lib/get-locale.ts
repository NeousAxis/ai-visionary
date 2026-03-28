import { cookies } from 'next/headers';

export type SupportedLocale = 'fr' | 'en';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['fr', 'en'];
export const DEFAULT_LOCALE: SupportedLocale = 'fr';

/**
 * Server-side utility to get the current locale from cookies.
 * Use this in API routes and server components that don't use next-intl.
 */
export async function getServerLocale(): Promise<SupportedLocale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('NEXT_LOCALE')?.value ?? '';
  if (SUPPORTED_LOCALES.includes(raw as SupportedLocale)) {
    return raw as SupportedLocale;
  }
  return DEFAULT_LOCALE;
}

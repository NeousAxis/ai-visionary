import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async () => {
  // 1. L'URL fait foi. Le middleware pose `x-locale: fr` sur les chemins /fr/...
  //    Il DOIT primer sur le cookie : sinon un visiteur ayant choisi l'anglais
  //    verrait /fr/... en anglais, et Google se retrouverait avec deux URLs au
  //    contenu identique. L'adresse est la source de vérité ; la préférence ne
  //    s'applique qu'aux URLs sans préfixe.
  const pathLocale = (await headers()).get('x-locale') ?? '';
  if ((locales as readonly string[]).includes(pathLocale)) {
    const locale = pathLocale as Locale;
    return {
      locale,
      messages: (await import(`../messages/${locale}.json`)).default,
    };
  }

  // 2. Sinon : préférence explicite (cookie), puis langue du navigateur.
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

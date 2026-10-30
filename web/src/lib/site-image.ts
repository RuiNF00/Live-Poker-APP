import type { Locale } from '@/lib/i18n';

/** The site's link preview in a page's language (og:image, twitter:image): /og/site draws it. */
export const siteImage = (locale: Locale, alt = 'Sweatbook') => ({ url: `/og/site?lang=${locale}`, width: 1200, height: 630, alt });

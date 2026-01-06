import { useHead } from '#app';

interface UseSimpleHeadOptions {
  /**
   * The language of the page, used for SEO and accessibility
   * @default 'en'
   */
  lang?: string;

  /**
   * The title of the page, used for SEO and social media sharing
   * @default 'Refurbished!'
   */
  title?: string;

  /**
   * The description of the page, used for SEO and social media sharing
   */
  description?: string;

  /**
   * If true, the title will be suffixed with " - Refurbished!"
   * @default true
   */
  suffixedTitle?: boolean;

  /**
   * Same `htmlAttrs` as in `useHead`
   */
  htmlAttrs?: Record<string, string>;

  /**
   * Same `bodyAttrs` as in `useHead`
   */
  bodyAttrs?: Record<string, string>;
}

export function useSimpleHead({
  lang = 'en',
  title = 'Refurbished!',
  description,
  suffixedTitle = true,
  htmlAttrs = {},
  bodyAttrs = {},
}: UseSimpleHeadOptions) {
  return useHead({
    htmlAttrs: { ...htmlAttrs, lang },
    bodyAttrs: { ...bodyAttrs },

    link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],

    title: suffixedTitle ? `${title} - Refurbished!` : title,

    meta: [
      { property: 'og:title', content: title },
      description ? { name: 'description', content: description } : null,
      description ? { property: 'og:description', content: description } : null,
    ].filter(Boolean),
  });
}

export default useSimpleHead;

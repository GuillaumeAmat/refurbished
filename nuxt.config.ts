// https://nuxt.com/docs/api/configuration/nuxt-config

import glslPlugin from 'vite-plugin-glsl';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: false },

  imports: {
    autoImport: false,
  },

  runtimeConfig: {
    public: {
      keyboardFallbackEnabled: true,
    },
  },

  vite: {
    plugins: [glslPlugin()],
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/test-utils',
    '@nuxt/ui',
    '@nuxtjs/robots',

    /**
     * Must always be last
     * See: https://sitemap.nuxtjs.org/fr/guide/setup
     */
    '@nuxtjs/sitemap',
  ],

  pages: {
    pattern: ['**/*.vue', '!**/components/**', '!**/composables/**'],
  },

  css: ['~/assets/css/main.css'],

  ui: {
    colorMode: false,
  },

  /**
   * See: https://nuxtseo.com/docs/robots/guides/nuxt-config
   */
  robots: {
    disallow: ['/*'],
  },

  /**
   * See: https://sitemap.nuxtjs.org/fr/usage/sitemap-options
   */
  sitemap: {
    exclude: ['/**'],
  },
});

import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';
import { brand } from './src/brand/brand.config';

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Fills the %BRAND_…% placeholders in index.html from the brand file. */
function brandedHtml(): Plugin {
  const values: Record<string, string> = {
    TITLE: brand.pageTitle,
    DESCRIPTION: brand.description,
    ICON: brand.images.symbol,
    THEME_COLOR: brand.colors.primary.DEFAULT,
  };
  return {
    name: 'branded-html',
    transformIndexHtml: (html) =>
      html.replace(/%BRAND_([A-Z_]+)%/g, (placeholder, key: string) => {
        const value = values[key];
        if (value === undefined) throw new Error(`index.html: unknown placeholder ${placeholder}`);
        return escapeHtml(value);
      }),
  };
}

// Tag error reports with the commit being deployed (Vercel sets VERCEL_GIT_COMMIT_SHA).
process.env.VITE_RELEASE ??= process.env.VERCEL_GIT_COMMIT_SHA;

export default defineConfig({
  plugins: [react(), brandedHtml()],
  server: {
    // Same origin as the API in development, exactly like the Vercel rewrite in production,
    // so the refresh-token cookie (SameSite=Lax, path /api/v1/auth) works unchanged.
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
    },
  },
});

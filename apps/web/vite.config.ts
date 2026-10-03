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
    APPLE_ICON: brand.images.appIcons.apple,
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

/**
 * The web app manifest (what an installed app is called and looks like), from the brand file:
 * served by the dev server and written into the build as /manifest.webmanifest.
 */
function webManifest(): Plugin {
  const { appIcons } = brand.images;
  const manifest = JSON.stringify({
    name: brand.productName,
    short_name: brand.shortName,
    description: brand.description,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: brand.colors.surface,
    theme_color: brand.colors.primary.DEFAULT,
    icons: [
      { src: appIcons.small, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: appIcons.large, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: appIcons.maskable, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
  return {
    name: 'web-manifest',
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.end(manifest);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: manifest });
    },
  };
}

// Tag error reports with the commit being deployed (Vercel sets VERCEL_GIT_COMMIT_SHA).
process.env.VITE_RELEASE ??= process.env.VERCEL_GIT_COMMIT_SHA;

export default defineConfig({
  plugins: [react(), brandedHtml(), webManifest()],
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

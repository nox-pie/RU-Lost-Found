import express, { Router, type RequestHandler } from 'express';
import helmet from 'helmet';
import { getAbsoluteFSPath } from 'swagger-ui-dist';

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API documentation</title>
    <link rel="stylesheet" href="docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="docs/assets/swagger-ui-bundle.js"></script>
    <script src="docs/init.js"></script>
  </body>
</html>`;

// A file, not an inline script, so the page's content security policy needs no 'unsafe-inline'.
const INIT = `window.ui = SwaggerUIBundle({
  url: 'openapi.json',
  dom_id: '#swagger-ui',
  deepLinking: true,
  persistAuthorization: false,
  withCredentials: true,
});`;

/**
 * The OpenAPI document and an interactive viewer (Swagger UI, served from the installed package,
 * not a CDN). The viewer gets its own content security policy: scripts and styles from this
 * origin only. The rest of the API keeps `default-src 'none'`.
 */
export function createDocsRouter(document: object): Router {
  const router = Router();
  const json = JSON.stringify(document);

  const docsPolicy: RequestHandler = helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      'default-src': ["'none'"],
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
    },
  });

  router.get('/openapi.json', (_req, res) => {
    res.type('application/json').send(json);
  });
  router.get('/docs', docsPolicy, (_req, res) => {
    res.type('html').send(PAGE);
  });
  router.get('/docs/init.js', (_req, res) => {
    res.type('application/javascript').send(INIT);
  });
  router.use(
    '/docs/assets',
    express.static(getAbsoluteFSPath(), { index: false, maxAge: '7d', immutable: true }),
  );
  return router;
}

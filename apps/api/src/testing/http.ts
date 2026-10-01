import { createServer, type RequestListener, type Server } from 'node:http';
import { afterAll } from 'vitest';

const open: Server[] = [];

afterAll(async () => {
  await Promise.all(
    open.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

/**
 * Starts an HTTP server for tests, bound explicitly to 127.0.0.1 on a free port.
 *
 * Supertest's default (`request(app)`) listens on all addresses (`::`) but connects to 127.0.0.1.
 * With many test files running in parallel, another process can bind 127.0.0.1 on the same port
 * number, and the request then silently reaches the wrong server. Binding the exact address the
 * client connects to makes the port unique. Servers are closed after the test file.
 */
export async function serve(app: RequestListener): Promise<Server> {
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  open.push(server);
  return server;
}

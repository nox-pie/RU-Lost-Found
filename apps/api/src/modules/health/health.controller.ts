import type { RequestHandler } from 'express';
import type { HealthService } from './health.service';

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  live: RequestHandler = (_req, res) => {
    res.json(this.healthService.live());
  };

  /**
   * How the API sees the caller: the client IP it resolved, and the proxy chain the request came
   * through (X-Forwarded-For, nearest proxy last). Used after a deploy to set TRUST_PROXY_HOPS:
   * `ip` must be the caller's own public address. It only reflects the caller's own request.
   */
  client: RequestHandler = (req, res) => {
    const header = req.headers['x-forwarded-for'];
    const forwardedFor = (Array.isArray(header) ? header.join(',') : (header ?? ''))
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(-10);
    res.json({
      ip: req.ip ?? null,
      forwardedFor,
      directPeer: req.socket.remoteAddress ?? null,
      trustProxyHops: req.app.get('trust proxy') as unknown,
    });
  };

  ready: RequestHandler = async (_req, res) => {
    const report = await this.healthService.ready();
    res.status(report.status === 'ok' ? 200 : 503).json(report);
  };
}

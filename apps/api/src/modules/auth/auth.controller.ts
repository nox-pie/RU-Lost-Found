import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import type {
  AuthResponse,
  DemoSignInInput,
  DemoStatusResponse,
  LoginInput,
  MessageResponse,
  RegisterInput,
  RequestOtpInput,
  ResetPasswordInput,
  VerifyOtpInput,
} from '@ru-lost-found/shared';
import { UnauthorizedError } from '../../core/errors/AppError';
import { toMeDto } from '../users/user.mapper';
import type { AuthResult, AuthService } from './auth.service';
import type { ClientInfo } from './SessionManager';

export const REFRESH_COOKIE = 'rlf_refresh';
/** The browser only sends the refresh cookie to the auth endpoints, never to the rest of the API. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function clientOf(req: Request): ClientInfo {
  return { userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null };
}

function refreshTokenOf(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * The access token is returned in the body (the web app keeps it in memory).
 * The refresh token goes in an httpOnly cookie, out of reach of page scripts (XSS),
 * and SameSite=Lax stops other sites from triggering a refresh (CSRF).
 */
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly auth: AuthService,
    options: { secureCookies: boolean },
  ) {
    this.cookieOptions = {
      httpOnly: true,
      secure: options.secureCookies,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    };
  }

  requestOtp: RequestHandler = async (req, res) => {
    await this.auth.requestOtp(req.body as RequestOtpInput);
    const body: MessageResponse = {
      message: 'If this email can be used, a 6-digit code is on its way. It expires in 10 minutes.',
    };
    res.status(202).json(body);
  };

  verifyOtp: RequestHandler = async (req, res) => {
    res.json(await this.auth.verifyOtp(req.body as VerifyOtpInput));
  };

  register: RequestHandler = async (req, res) => {
    const result = await this.auth.register(req.body as RegisterInput, clientOf(req));
    this.sendSession(res.status(201), result);
  };

  login: RequestHandler = async (req, res) => {
    const result = await this.auth.login(req.body as LoginInput, clientOf(req));
    this.sendSession(res, result);
  };

  refresh: RequestHandler = async (req, res) => {
    const token = refreshTokenOf(req);
    if (!token) throw new UnauthorizedError('Your session has ended. Please sign in again.');
    try {
      this.sendSession(res, await this.auth.refresh(token, clientOf(req)));
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
      throw error;
    }
  };

  logout: RequestHandler = async (req, res) => {
    await this.auth.logout(refreshTokenOf(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
    res.status(204).end();
  };

  resetPassword: RequestHandler = async (req, res) => {
    await this.auth.resetPassword(req.body as ResetPasswordInput);
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions);
    const body: MessageResponse = { message: 'Your password has been changed. Please sign in.' };
    res.json(body);
  };

  demoStatus: RequestHandler = (_req, res) => {
    const body: DemoStatusResponse = { enabled: this.auth.demoSignInEnabled };
    res.json(body);
  };

  demoSignIn: RequestHandler = async (req, res) => {
    const result = await this.auth.signInAsDemo(req.body as DemoSignInInput, clientOf(req));
    this.sendSession(res, result);
  };

  private sendSession(res: Response, result: AuthResult): void {
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      ...this.cookieOptions,
      expires: result.refreshTokenExpiresAt,
    });
    const body: AuthResponse = {
      accessToken: result.accessToken,
      expiresIn: result.accessTokenExpiresIn,
      user: toMeDto(result.user),
    };
    res.json(body);
  }
}

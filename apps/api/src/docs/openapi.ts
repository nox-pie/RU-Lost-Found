import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import {
  ERROR_CODES,
  approveClaimSchema,
  changeRoleSchema,
  claimIdParamsSchema,
  createItemSchema,
  flagItemSchema,
  handoverSchema,
  itemIdParamsSchema,
  listAdminItemsQuerySchema,
  listAuditQuerySchema,
  listClaimsQuerySchema,
  listItemsQuerySchema,
  listNotificationsQuerySchema,
  listReportsQuerySchema,
  listUsersQuerySchema,
  loginSchema,
  markNotificationsReadSchema,
  moderateItemSchema,
  pageQuerySchema,
  registerSchema,
  removePostSchema,
  rejectClaimSchema,
  requestOtpSchema,
  resetPasswordSchema,
  submitClaimSchema,
  suspendUserSchema,
  updateItemSchema,
  updateProfileSchema,
  userIdParamsSchema,
  verifyOtpSchema,
} from '@ru-lost-found/shared';
import { z, type AnyZodObject, type ZodTypeAny } from 'zod';

// Adds `.openapi()` to Zod's prototype, which the generator uses for named components.
extendZodWithOpenApi(z);

/** Who may call an operation. Drives the security requirement and the documented errors. */
type Access = 'public' | 'cookie' | 'user' | 'staff' | 'admin';

export interface Operation {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete';
  /** Express-style path under /api/v1, e.g. `/items/:id`. */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  access: Access;
  params?: AnyZodObject;
  query?: AnyZodObject;
  body?: ZodTypeAny;
  /** Multipart upload: the body fields plus file fields. */
  upload?: { fields?: ZodTypeAny; files: string; maxFiles: number };
  /** Has its own rate limit (429 documented). */
  limited?: boolean;
  /** Success status → description (the shared DTO type it returns). */
  ok: Record<number, string>;
}

const PAGE =
  'Page<T>: `{ data: T[], nextCursor: string | null }`. Pass `nextCursor` back as `cursor`.';

/**
 * Every operation of the API. Requests are described by the same Zod schemas the API validates
 * with (packages/shared), so the documentation can't drift from the validation. Responses name
 * the shared DTO type they return. A test checks that every operation listed here is routed.
 */
export const OPERATIONS: Operation[] = [
  // Health
  {
    method: 'get',
    path: '/health/live',
    tag: 'Health',
    summary: 'Process is running',
    access: 'public',
    ok: { 200: '`{ status: "ok" }`' },
  },
  {
    method: 'get',
    path: '/health/ready',
    tag: 'Health',
    summary: 'Database and cache reachable',
    access: 'public',
    ok: { 200: 'Every dependency is healthy', 503: 'A dependency is down' },
  },
  {
    method: 'get',
    path: '/health/client',
    tag: 'Health',
    summary: 'How the API sees the caller (client IP and proxy chain)',
    description:
      'For checking TRUST_PROXY_HOPS after a deploy: `ip` must be your own public address.',
    access: 'public',
    ok: { 200: '`{ ip, forwardedFor, directPeer, trustProxyHops }`' },
  },

  // Auth
  {
    method: 'post',
    path: '/auth/otp',
    tag: 'Auth',
    summary: 'Email a 6-digit code (sign-up or password reset)',
    description: 'Always answers the same way, whether or not the email has an account.',
    access: 'public',
    body: requestOtpSchema,
    limited: true,
    ok: { 202: 'MessageResponse' },
  },
  {
    method: 'post',
    path: '/auth/otp/verify',
    tag: 'Auth',
    summary: 'Exchange the code for a 30-minute verification token',
    access: 'public',
    body: verifyOtpSchema,
    limited: true,
    ok: { 200: 'VerifyOtpResponse' },
  },
  {
    method: 'post',
    path: '/auth/register',
    tag: 'Auth',
    summary: 'Create the account',
    description: 'Sets the httpOnly refresh-token cookie.',
    access: 'public',
    body: registerSchema,
    limited: true,
    ok: { 201: 'AuthResponse' },
  },
  {
    method: 'post',
    path: '/auth/login',
    tag: 'Auth',
    summary: 'Sign in',
    description: 'Sets the httpOnly refresh-token cookie.',
    access: 'public',
    body: loginSchema,
    limited: true,
    ok: { 200: 'AuthResponse' },
  },
  {
    method: 'post',
    path: '/auth/refresh',
    tag: 'Auth',
    summary: 'New access token from the refresh cookie',
    description:
      'The refresh token is rotated on every call; replaying an old one ends the whole session family.',
    access: 'cookie',
    limited: true,
    ok: { 200: 'AuthResponse' },
  },
  {
    method: 'post',
    path: '/auth/logout',
    tag: 'Auth',
    summary: 'End this device’s session',
    access: 'cookie',
    ok: { 204: 'Signed out' },
  },
  {
    method: 'post',
    path: '/auth/password/reset',
    tag: 'Auth',
    summary: 'Set a new password with a verification token',
    description: 'Signs the user out everywhere.',
    access: 'public',
    body: resetPasswordSchema,
    limited: true,
    ok: { 200: 'MessageResponse' },
  },

  // Users
  {
    method: 'get',
    path: '/users/me',
    tag: 'Users',
    summary: 'My account',
    access: 'user',
    ok: { 200: 'MeDto' },
  },
  {
    method: 'patch',
    path: '/users/me',
    tag: 'Users',
    summary: 'Edit my profile',
    access: 'user',
    body: updateProfileSchema,
    ok: { 200: 'MeDto' },
  },
  {
    method: 'put',
    path: '/users/me/avatar',
    tag: 'Users',
    summary: 'Upload a profile picture (≤ 2 MB)',
    access: 'user',
    upload: { files: 'avatar', maxFiles: 1 },
    limited: true,
    ok: { 200: 'MeDto' },
  },
  {
    method: 'delete',
    path: '/users/me/avatar',
    tag: 'Users',
    summary: 'Remove my profile picture',
    access: 'user',
    ok: { 200: 'MeDto' },
  },
  {
    method: 'get',
    path: '/universities/current',
    tag: 'Users',
    summary: 'My university (name, schools)',
    access: 'user',
    ok: { 200: 'UniversityDto' },
  },

  // Items
  {
    method: 'get',
    path: '/items',
    tag: 'Items',
    summary: 'Search and filter posts',
    access: 'user',
    query: listItemsQuerySchema,
    ok: { 200: `${PAGE} T = ItemDto` },
  },
  {
    method: 'get',
    path: '/items/mine',
    tag: 'Items',
    summary: 'Posts I made',
    access: 'user',
    query: pageQuerySchema,
    ok: { 200: `${PAGE} T = ItemDto` },
  },
  {
    method: 'post',
    path: '/items',
    tag: 'Items',
    summary: 'Report a lost or found item (1–3 photos, ≤ 5 MB each)',
    access: 'user',
    upload: { fields: createItemSchema, files: 'photos', maxFiles: 3 },
    limited: true,
    ok: { 201: 'ItemDto' },
  },
  {
    method: 'get',
    path: '/items/:id',
    tag: 'Items',
    summary: 'One post',
    access: 'user',
    params: itemIdParamsSchema,
    ok: { 200: 'ItemDto' },
  },
  {
    method: 'patch',
    path: '/items/:id',
    tag: 'Items',
    summary: 'Edit my post',
    access: 'user',
    params: itemIdParamsSchema,
    body: updateItemSchema,
    ok: { 200: 'ItemDto' },
  },
  {
    method: 'delete',
    path: '/items/:id',
    tag: 'Items',
    summary: 'Remove a post (its reporter or an admin)',
    access: 'user',
    params: itemIdParamsSchema,
    ok: { 204: 'Removed' },
  },
  {
    method: 'post',
    path: '/items/:id/reports',
    tag: 'Moderation',
    summary: 'Report a post to the admins',
    access: 'user',
    params: itemIdParamsSchema,
    body: flagItemSchema,
    limited: true,
    ok: { 201: 'MessageResponse' },
  },

  // Claims
  {
    method: 'post',
    path: '/items/:id/claims',
    tag: 'Claims',
    summary: 'Claim an item (“this is mine” / “I found this”)',
    access: 'user',
    params: itemIdParamsSchema,
    body: submitClaimSchema,
    limited: true,
    ok: { 201: 'ClaimDto' },
  },
  {
    method: 'get',
    path: '/items/:id/claims',
    tag: 'Claims',
    summary: 'Claims on an item (its reporter, staff)',
    access: 'user',
    params: itemIdParamsSchema,
    query: listClaimsQuerySchema,
    ok: { 200: `${PAGE} T = ClaimDto` },
  },
  {
    method: 'get',
    path: '/claims/mine',
    tag: 'Claims',
    summary: 'Claims I made',
    access: 'user',
    query: listClaimsQuerySchema,
    ok: { 200: `${PAGE} T = ClaimDto` },
  },
  {
    method: 'get',
    path: '/claims/received',
    tag: 'Claims',
    summary: 'Claims on my posts',
    access: 'user',
    query: listClaimsQuerySchema,
    ok: { 200: `${PAGE} T = ClaimDto` },
  },
  {
    method: 'get',
    path: '/claims/:id',
    tag: 'Claims',
    summary: 'One claim (its parties, staff)',
    description: 'The handover code is shown only to the item’s owner.',
    access: 'user',
    params: claimIdParamsSchema,
    ok: { 200: 'ClaimDto' },
  },
  {
    method: 'post',
    path: '/claims/:id/approve',
    tag: 'Claims',
    summary: 'Approve (reporter): reserves the item, issues the handover code',
    access: 'user',
    params: claimIdParamsSchema,
    body: approveClaimSchema,
    ok: { 200: 'ClaimDto' },
  },
  {
    method: 'post',
    path: '/claims/:id/reject',
    tag: 'Claims',
    summary: 'Decline (reporter)',
    access: 'user',
    params: claimIdParamsSchema,
    body: rejectClaimSchema,
    ok: { 200: 'ClaimDto' },
  },
  {
    method: 'post',
    path: '/claims/:id/cancel',
    tag: 'Claims',
    summary: 'Withdraw or cancel',
    access: 'user',
    params: claimIdParamsSchema,
    ok: { 200: 'ClaimDto' },
  },
  {
    method: 'post',
    path: '/claims/:id/handover',
    tag: 'Claims',
    summary: 'Confirm the handover with the owner’s code',
    description: '5 wrong codes lock the claim; staff can then confirm in person.',
    access: 'user',
    params: claimIdParamsSchema,
    body: handoverSchema,
    limited: true,
    ok: { 200: 'ClaimDto' },
  },
  {
    method: 'post',
    path: '/claims/:id/handover/staff',
    tag: 'Claims',
    summary: 'Confirm a handover witnessed at the security desk',
    access: 'staff',
    params: claimIdParamsSchema,
    ok: { 200: 'ClaimDto' },
  },

  // Notifications
  {
    method: 'get',
    path: '/notifications',
    tag: 'Notifications',
    summary: 'My notifications, newest first',
    access: 'user',
    query: listNotificationsQuerySchema,
    ok: { 200: 'NotificationPage (Page<NotificationDto> + unreadCount)' },
  },
  {
    method: 'post',
    path: '/notifications/read',
    tag: 'Notifications',
    summary: 'Mark some (or all) as read',
    access: 'user',
    body: markNotificationsReadSchema,
    ok: { 200: '`{ unreadCount: number }`' },
  },

  // Admin
  {
    method: 'get',
    path: '/admin/stats',
    tag: 'Admin',
    summary: 'University statistics',
    access: 'admin',
    ok: { 200: 'UniversityStatsDto' },
  },
  {
    method: 'get',
    path: '/admin/users',
    tag: 'Admin',
    summary: 'Search people',
    access: 'admin',
    query: listUsersQuerySchema,
    ok: { 200: `${PAGE} T = AdminUserDto` },
  },
  {
    method: 'patch',
    path: '/admin/users/:id/role',
    tag: 'Admin',
    summary: 'Change a role (people ranked below you; roles up to your own)',
    access: 'admin',
    params: userIdParamsSchema,
    body: changeRoleSchema,
    ok: { 200: 'AdminUserDto' },
  },
  {
    method: 'post',
    path: '/admin/users/:id/suspend',
    tag: 'Admin',
    summary: 'Suspend: blocks sign-in and ends every session',
    access: 'admin',
    params: userIdParamsSchema,
    body: suspendUserSchema,
    ok: { 200: 'AdminUserDto' },
  },
  {
    method: 'post',
    path: '/admin/users/:id/reactivate',
    tag: 'Admin',
    summary: 'Undo a suspension',
    access: 'admin',
    params: userIdParamsSchema,
    ok: { 200: 'AdminUserDto' },
  },
  {
    method: 'get',
    path: '/admin/audit',
    tag: 'Admin',
    summary: 'Activity (audit) log',
    description:
      'Filter by action, person (`actorId`), record (`targetId`) and time (`from` inclusive, `until` exclusive).',
    access: 'admin',
    // The object inside the refinement (the from-before-until rule still applies to requests).
    query: listAuditQuerySchema.innerType(),
    ok: { 200: `${PAGE} T = AuditEntryDto` },
  },
  {
    method: 'get',
    path: '/admin/items',
    tag: 'Moderation',
    summary: 'Every post of the university, removed ones included',
    access: 'admin',
    query: listAdminItemsQuerySchema,
    ok: { 200: `${PAGE} T = ItemDto` },
  },
  {
    method: 'post',
    path: '/admin/items/:id/remove',
    tag: 'Moderation',
    summary: 'Remove a post, with a reason for the poster; closes its open reports',
    access: 'admin',
    params: itemIdParamsSchema,
    body: removePostSchema,
    ok: { 200: '`{ resolvedReports: number }`' },
  },
  {
    method: 'get',
    path: '/admin/reports',
    tag: 'Moderation',
    summary: 'Review queue of reported posts',
    access: 'admin',
    query: listReportsQuerySchema,
    ok: { 200: `${PAGE} T = ModerationReportDto` },
  },
  {
    method: 'post',
    path: '/admin/items/:id/moderation',
    tag: 'Moderation',
    summary: 'Decide every open report on a post',
    access: 'admin',
    params: itemIdParamsSchema,
    body: moderateItemSchema,
    ok: { 200: '`{ resolved: number }`' },
  },
];

const errorBody = z.object({
  error: z.object({
    code: z.enum(Object.values(ERROR_CODES) as [string, ...string[]]),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});

const toOpenApiPath = (path: string) => path.replace(/:(\w+)/g, '{$1}');

function errorsFor(op: Operation): Record<number, string> {
  const errors: Record<number, string> = {};
  if (op.params || op.query || op.body || op.upload)
    errors[400] = 'Invalid input (`details` lists each field)';
  if (op.access !== 'public') errors[401] = 'Not signed in, or the session expired';
  if (op.access === 'staff' || op.access === 'admin' || op.access === 'user') {
    errors[403] = 'Not allowed for this user';
  }
  if (op.params) errors[404] = 'Not found (or in another university)';
  if (op.method !== 'get') errors[409] = 'Conflicts with the current state (e.g. already decided)';
  if (op.limited || op.method !== 'get') errors[429] = 'Too many requests (`Retry-After` header)';
  return errors;
}

function requestOf(op: Operation): RouteConfig['request'] {
  const request: NonNullable<RouteConfig['request']> = {};
  if (op.params) request.params = op.params;
  if (op.query) request.query = op.query;
  if (op.body) request.body = { content: { 'application/json': { schema: op.body } } };
  if (op.upload) {
    const files = z
      .array(z.string())
      .max(op.upload.maxFiles)
      .describe('Image files (JPEG, PNG, WebP)');
    const fields = op.upload.fields instanceof z.ZodObject ? op.upload.fields : z.object({});
    request.body = {
      content: {
        'multipart/form-data': {
          schema: fields.extend({ [op.upload.files]: files }),
        },
      },
    };
  }
  return request;
}

/** The OpenAPI 3.1 document, built once at startup. */
export function buildOpenApiDocument(info: { title: string; version: string; serverUrl: string }) {
  const registry = new OpenAPIRegistry();
  const bearer = registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Access token from sign-in or refresh; valid for 15 minutes.',
  });
  const cookie = registry.registerComponent('securitySchemes', 'refreshCookie', {
    type: 'apiKey',
    in: 'cookie',
    name: 'rlf_refresh',
    description: 'httpOnly refresh token, set by sign-in; rotated on every refresh.',
  });
  const error = registry.register('Error', errorBody);

  for (const op of OPERATIONS) {
    const responses: RouteConfig['responses'] = {};
    for (const [status, description] of Object.entries(op.ok)) {
      responses[status] = { description };
    }
    for (const [status, description] of Object.entries(errorsFor(op))) {
      responses[status] = { description, content: { 'application/json': { schema: error } } };
    }
    registry.registerPath({
      method: op.method,
      path: toOpenApiPath(op.path),
      tags: [op.tag],
      summary: op.summary,
      description: op.description,
      security:
        op.access === 'public'
          ? []
          : op.access === 'cookie'
            ? [{ [cookie.name]: [] }]
            : [{ [bearer.name]: [] }],
      request: requestOf(op),
      responses,
    });
  }

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: info.title,
      version: info.version,
      description:
        'REST API of the lost & found portal. Errors always use the `Error` shape. Lists use cursor pagination.',
    },
    servers: [{ url: info.serverUrl }],
  });
}

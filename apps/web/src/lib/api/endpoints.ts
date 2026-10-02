import type {
  AdminUserDto,
  AuditAction,
  AuditEntryDto,
  AuthResponse,
  ClaimDto,
  FlagItemInput,
  ItemDto,
  MeDto,
  MessageResponse,
  ModerateItemInput,
  ModerationReportDto,
  NotificationPage,
  OtpPurpose,
  Page,
  RegisterInput,
  Role,
  UniversityDto,
  UniversityStatsDto,
  UpdateItemInput,
  UpdateProfileInput,
  VerifyOtpResponse,
} from '@ru-lost-found/shared';
import { api } from './client';

/** Typed wrappers for every API endpoint the app uses, grouped by module. */

export const authApi = {
  requestCode: (email: string, purpose: OtpPurpose) =>
    api<MessageResponse>('/auth/otp', { method: 'POST', json: { email, purpose } }),
  verifyCode: (email: string, purpose: OtpPurpose, code: string) =>
    api<VerifyOtpResponse>('/auth/otp/verify', { method: 'POST', json: { email, purpose, code } }),
  register: (input: RegisterInput) =>
    api<AuthResponse>('/auth/register', { method: 'POST', json: input }),
  login: (email: string, password: string) =>
    api<AuthResponse>('/auth/login', { method: 'POST', json: { email, password } }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  resetPassword: (verificationToken: string, newPassword: string) =>
    api<MessageResponse>('/auth/password/reset', {
      method: 'POST',
      json: { verificationToken, newPassword },
    }),
};

export const usersApi = {
  me: () => api<MeDto>('/users/me'),
  update: (changes: UpdateProfileInput) =>
    api<MeDto>('/users/me', { method: 'PATCH', json: changes }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return api<MeDto>('/users/me/avatar', { method: 'PUT', form });
  },
  removeAvatar: () => api<MeDto>('/users/me/avatar', { method: 'DELETE' }),
  university: () => api<UniversityDto>('/universities/current'),
};

export interface ItemFilters {
  q?: string;
  type?: 'LOST' | 'FOUND';
  category?: string;
  status?: string;
}

export const itemsApi = {
  list: (filters: ItemFilters, cursor?: string) =>
    api<Page<ItemDto>>('/items', { query: { ...filters, cursor, limit: 12 } }),
  mine: (cursor?: string) => api<Page<ItemDto>>('/items/mine', { query: { cursor, limit: 12 } }),
  get: (id: string) => api<ItemDto>(`/items/${id}`),
  create: (form: FormData) => api<ItemDto>('/items', { method: 'POST', form }),
  update: (id: string, changes: UpdateItemInput) =>
    api<ItemDto>(`/items/${id}`, { method: 'PATCH', json: changes }),
  remove: (id: string) => api<void>(`/items/${id}`, { method: 'DELETE' }),
  /** Reports a post to the admins (spam, scam, ...). */
  flag: (id: string, input: FlagItemInput) =>
    api<MessageResponse>(`/items/${id}/reports`, { method: 'POST', json: input }),
};

export interface SubmitClaimBody {
  message: string;
  answers: { questionId: string; answer: string }[];
  sharePhone: boolean;
}

export const claimsApi = {
  submit: (itemId: string, body: SubmitClaimBody) =>
    api<ClaimDto>(`/items/${itemId}/claims`, { method: 'POST', json: body }),
  forItem: (itemId: string) =>
    api<Page<ClaimDto>>(`/items/${itemId}/claims`, { query: { limit: 50 } }),
  mine: (query: { status?: string }, cursor?: string) =>
    api<Page<ClaimDto>>('/claims/mine', { query: { status: query.status, cursor, limit: 20 } }),
  received: (query: { status?: string }, cursor?: string) =>
    api<Page<ClaimDto>>('/claims/received', { query: { status: query.status, cursor, limit: 20 } }),
  get: (id: string) => api<ClaimDto>(`/claims/${id}`),
  approve: (id: string, sharePhone: boolean) =>
    api<ClaimDto>(`/claims/${id}/approve`, { method: 'POST', json: { sharePhone } }),
  reject: (id: string, reason?: string) =>
    api<ClaimDto>(`/claims/${id}/reject`, { method: 'POST', json: reason ? { reason } : {} }),
  cancel: (id: string) => api<ClaimDto>(`/claims/${id}/cancel`, { method: 'POST', json: {} }),
  handover: (id: string, code: string) =>
    api<ClaimDto>(`/claims/${id}/handover`, { method: 'POST', json: { code } }),
  handoverAsStaff: (id: string) =>
    api<ClaimDto>(`/claims/${id}/handover/staff`, { method: 'POST', json: {} }),
};

export const notificationsApi = {
  list: (unread = false) =>
    api<NotificationPage>('/notifications', { query: { unread, limit: 15 } }),
  markRead: (ids?: string[]) =>
    api<{ unreadCount: number }>('/notifications/read', {
      method: 'POST',
      json: ids ? { ids } : {},
    }),
};

export interface AdminItemFilters {
  q?: string;
  type?: 'LOST' | 'FOUND';
  status?: string;
}

/** `from` (inclusive) and `until` (exclusive) are exact moments, as ISO strings. */
export interface ActivityFilters {
  action?: AuditAction;
  actorId?: string;
  from?: string;
  until?: string;
}

export interface UserFilters {
  q?: string;
  role?: Role;
  status?: 'ACTIVE' | 'SUSPENDED';
}

export const adminApi = {
  stats: () => api<UniversityStatsDto>('/admin/stats'),
  users: (filters: UserFilters, cursor?: string) =>
    api<Page<AdminUserDto>>('/admin/users', { query: { ...filters, cursor, limit: 20 } }),
  changeRole: (userId: string, role: Role) =>
    api<AdminUserDto>(`/admin/users/${userId}/role`, { method: 'PATCH', json: { role } }),
  suspend: (userId: string, reason: string) =>
    api<AdminUserDto>(`/admin/users/${userId}/suspend`, { method: 'POST', json: { reason } }),
  reactivate: (userId: string) =>
    api<AdminUserDto>(`/admin/users/${userId}/reactivate`, { method: 'POST', json: {} }),
  reports: (status: 'OPEN' | 'RESOLVED', cursor?: string) =>
    api<Page<ModerationReportDto>>('/admin/reports', { query: { status, cursor, limit: 20 } }),
  moderate: (itemId: string, input: ModerateItemInput) =>
    api<{ resolved: number }>(`/admin/items/${itemId}/moderation`, { method: 'POST', json: input }),
  items: (filters: AdminItemFilters, cursor?: string) =>
    api<Page<ItemDto>>('/admin/items', { query: { ...filters, cursor, limit: 20 } }),
  /** Removes any post (also an admin's own, also after handover); closes its open reports. */
  removePost: (itemId: string, reason?: string) =>
    api<{ resolvedReports: number }>(`/admin/items/${itemId}/remove`, {
      method: 'POST',
      json: reason ? { reason } : {},
    }),
  activity: (filters: ActivityFilters, cursor?: string) =>
    api<Page<AuditEntryDto>>('/admin/audit', { query: { ...filters, cursor, limit: 50 } }),
};

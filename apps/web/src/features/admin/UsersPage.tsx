import { ROLES, ROLE_RANK, type AdminUserDto, type MeDto, type Role } from '@ru-lost-found/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input, Select, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Avatar, Badge, EmptyState, ErrorState, PageLoader } from '../../components/ui/misc';
import { adminApi, type UserFilters } from '../../lib/api/endpoints';
import { ROLE_LABELS, formatDay } from '../../lib/format';
import { useDebouncedValue } from '../../lib/hooks';
import { queryKeys } from '../../lib/queryClient';
import { useCurrentUser } from '../auth/authContext';

/** Mirrors the API's rule: admins manage only people ranked below them, never themselves. */
const canManage = (me: MeDto, user: AdminUserDto) =>
  me.id !== user.id && ROLE_RANK[user.role] < ROLE_RANK[me.role];

export default function UsersPage() {
  const me = useCurrentUser();
  const [text, setText] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<UserFilters['status'] | ''>('');
  const q = useDebouncedValue(text.trim(), 300);
  const filters: UserFilters = {
    q: q || undefined,
    role: role || undefined,
    status: status || undefined,
  };

  const query = useInfiniteQuery({
    queryKey: queryKeys.admin.users(filters),
    queryFn: ({ pageParam }) => adminApi.users(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const users = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div>
      <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-[1fr_12rem_10rem]">
        <Input
          label="Search"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Name or email"
          maxLength={100}
        />
        <Select
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as Role | '')}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value as UserFilters['status'] | '')}
        >
          <option value="">Everyone</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </div>

      <div className="mt-6">
        {query.isPending ? (
          <PageLoader />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : users.length === 0 ? (
          <EmptyState icon={<Users className="h-10 w-10" />} title="Nobody found">
            Try another name, or clear the filters.
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y overflow-hidden rounded-2xl bg-white shadow-sm">
              {users.map((user) => (
                <UserRow key={user.id} user={user} me={me} />
              ))}
            </ul>
            {query.hasNextPage && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  loading={query.isFetchingNextPage}
                  onClick={() => void query.fetchNextPage()}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function UserRow({ user, me }: { user: AdminUserDto; me: MeDto }) {
  const queryClient = useQueryClient();
  const [suspending, setSuspending] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const manageable = canManage(me, user);
  const name = `${user.firstName} ${user.lastName}`;

  const onDone = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    toast.success(message);
  };
  const changeRole = useMutation({
    mutationFn: (role: Role) => adminApi.changeRole(user.id, role),
    onSuccess: (updated) => onDone(`${name} is now ${ROLE_LABELS[updated.role].toLowerCase()}.`),
    onError: (error) => toast.error(error.message),
  });
  const reactivate = useMutation({
    mutationFn: () => adminApi.reactivate(user.id),
    onSuccess: async () => {
      setReactivating(false);
      await onDone(`${name} can sign in again.`);
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-grow items-center gap-3">
        <Avatar name={name} url={user.avatarUrl} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
            <span className="truncate">{name}</span>
            {me.id === user.id && <Badge>You</Badge>}
            {user.status === 'SUSPENDED' && <Badge tone="danger">Suspended</Badge>}
          </p>
          <p className="truncate text-sm text-gray-500">{user.email}</p>
          <p className="truncate text-xs text-gray-500">
            {user.school} · year {user.year} · {user.enrollmentNumber} · joined{' '}
            {formatDay(user.createdAt.slice(0, 10))}
          </p>
        </div>
      </div>

      {manageable ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <label className="sr-only" htmlFor={`role-${user.id}`}>
            Role of {name}
          </label>
          <select
            id={`role-${user.id}`}
            value={user.role}
            disabled={changeRole.isPending}
            onChange={(event) => changeRole.mutate(event.target.value as Role)}
            className="h-8 rounded-xl border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60"
          >
            {ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[me.role]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {user.status === 'ACTIVE' ? (
            <Button variant="danger" size="sm" onClick={() => setSuspending(true)}>
              Suspend
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setReactivating(true)}>
              Reactivate
            </Button>
          )}
        </div>
      ) : (
        <div className="self-start sm:self-auto">
          <Badge tone="info">{ROLE_LABELS[user.role]}</Badge>
        </div>
      )}

      <SuspendDialog
        user={user}
        open={suspending}
        onClose={() => setSuspending(false)}
        onDone={(message) => onDone(message)}
      />
      <ConfirmDialog
        open={reactivating}
        title={`Reactivate ${name}?`}
        confirmLabel="Reactivate"
        loading={reactivate.isPending}
        onConfirm={() => reactivate.mutate()}
        onClose={() => setReactivating(false)}
      >
        They will be able to sign in again, and we’ll email them to say so.
      </ConfirmDialog>
    </li>
  );
}

function SuspendDialog({
  user,
  open,
  onClose,
  onDone,
}: {
  user: AdminUserDto;
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();
  const name = `${user.firstName} ${user.lastName}`;
  const suspend = useMutation({
    mutationFn: () => adminApi.suspend(user.id, reason.trim()),
    onSuccess: async () => {
      onClose();
      setReason('');
      await onDone(`${name} was suspended and signed out.`);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Modal open={open} onClose={onClose} title={`Suspend ${name}?`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (reason.trim().length < 5) return setError('Give a short reason');
          setError(undefined);
          suspend.mutate();
        }}
        noValidate
      >
        <p className="text-sm text-gray-600">
          They will be signed out on every device and can’t sign in until an admin reactivates them.
          We’ll email them the reason.
        </p>
        <div className="mt-4">
          <Textarea
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            error={error}
            maxLength={500}
            placeholder="e.g. Repeatedly posting fake items"
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={suspend.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" loading={suspend.isPending}>
            Suspend
          </Button>
        </div>
      </form>
    </Modal>
  );
}

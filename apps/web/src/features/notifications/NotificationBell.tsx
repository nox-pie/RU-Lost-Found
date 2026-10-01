import type { NotificationDto } from '@ru-lost-found/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { notificationsApi } from '../../lib/api/endpoints';
import { timeAgo } from '../../lib/format';
import { queryKeys } from '../../lib/queryClient';

/**
 * Bell with an unread badge and a dropdown of recent notifications. Polls every minute and
 * whenever the tab regains focus, so new claims show up without a reload.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => notificationsApi.list(),
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => notificationsApi.markRead(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = data?.unreadCount ?? 0;

  function openNotification(notification: NotificationDto) {
    if (!notification.read) markRead.mutate([notification.id]);
    setOpen(false);
    if (notification.link.claimId) navigate(`/claims/${notification.link.claimId}`);
    else if (notification.link.itemId) navigate(`/items/${notification.link.itemId}`);
  }

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-full p-2 text-white hover:bg-white/15"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-[11px] font-bold text-white ring-2 ring-primary">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border bg-white text-gray-800 shadow-xl animate-slide-down">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markRead.mutate(undefined)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {data?.data.length ? (
              data.data.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={`block w-full px-4 py-3 text-left hover:bg-gray-50 ${notification.read ? '' : 'bg-primary/5'}`}
                  >
                    <p className="flex items-start gap-2 text-sm font-medium">
                      {!notification.read && (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                      {notification.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{notification.body}</p>
                    <p className="mt-1 text-xs text-gray-400">{timeAgo(notification.createdAt)}</p>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-10 text-center text-sm text-gray-500">
                You're all caught up.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

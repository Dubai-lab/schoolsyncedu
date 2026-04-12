import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { notificationService } from '@/services/notificationService';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

function typeIcon(type: string) {
  if (type.includes('error') || type.includes('fail')) return <XCircle className="h-5 w-5 text-red-500" />;
  if (type.includes('warn') || type.includes('alert')) return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  if (type.includes('success') || type.includes('approved')) return <CheckCircle className="h-5 w-5 text-emerald-500" />;
  return <Info className="h-5 w-5 text-blue-500" />;
}

export default function Notifications() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data: result, isLoading } = useFetch(
    ['notifications', userId, String(page), String(unreadOnly)],
    () => notificationService.list(userId, { page, pageSize: 25, unreadOnly: unreadOnly || undefined }),
    { enabled: !!userId },
  );

  const markRead = useMutate(
    (id: string) => notificationService.markRead(id),
    [['notifications']],
  );

  const markAllRead = useMutate(
    () => notificationService.markAllRead(userId),
    [['notifications']],
  );

  const notifications = result?.data ?? [];
  const totalPages = Math.ceil((result?.count ?? 0) / 25);
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Communications', href: '/communications' }, { label: 'Notifications' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Bell className="h-5 w-5" /> Notifications
        </h1>
        <div className="flex gap-2 items-center">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead.mutate(undefined)} loading={markAllRead.isPending}>
              <CheckCheck className="h-4 w-4 mr-1" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={unreadOnly}
            onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
          Unread only
        </label>
        <Badge variant="info" size="sm">{result?.count ?? 0} total</Badge>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      {!isLoading && notifications.length === 0 && (
        <Card className="p-8 text-center text-slate-500">No notifications.</Card>
      )}

      <div className="space-y-2">
        {notifications.map((n) => (
          <Card
            key={n.id}
            className={`p-4 transition-colors ${!n.is_read ? 'border-l-4 border-l-primary-500 bg-primary-50/30 hover:bg-primary-50/50' : 'hover:bg-slate-50'}`}
            onClick={() => { if (!n.is_read) markRead.mutate(n.id); }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${!n.is_read ? 'text-slate-900' : 'text-slate-700'}`}>{n.title}</span>
                  {!n.is_read && <Badge variant="info" size="sm">New</Badge>}
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {new Date(n.created_at).toLocaleString()} • {n.type}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}
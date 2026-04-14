import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import {
  notificationService,
  type UserNotification,
  type NotificationType,
} from '@/services/notificationService';
import {
  Bell,
  X,
  CheckCheck,
  GraduationCap,
  FileText,
  Mail,
  AlertTriangle,
  Users,
  DollarSign,
  Library,
  Info,
  BookOpen,
} from 'lucide-react';

// ── Icon per notification type ────────────────────────────────────────────────
function NotifIcon({ type }: { type: NotificationType }) {
  const cls = 'h-4 w-4';
  switch (type) {
    case 'grade_approval':   return <FileText     className={`${cls} text-amber-500`} />;
    case 'letter_approval':  return <Mail         className={`${cls} text-orange-500`} />;
    case 'new_application':  return <GraduationCap className={`${cls} text-blue-500`} />;
    case 'new_incident':     return <AlertTriangle className={`${cls} text-red-500`} />;
    case 'new_referral':     return <Users        className={`${cls} text-purple-500`} />;
    case 'fee_overdue':      return <DollarSign   className={`${cls} text-rose-500`} />;
    case 'overdue_books':    return <BookOpen     className={`${cls} text-amber-600`} />;
    case 'subscription':     return <Library      className={`${cls} text-indigo-500`} />;
    default:                 return <Info         className={`${cls} text-slate-400`} />;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? '';

  const [open,         setOpen]         = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [loading,      setLoading]      = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  // Load notifications
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        notificationService.list(userId),
        notificationService.unreadCount(userId),
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch {
      // silent — bell should never crash the app
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Real-time: subscribe to new rows for this user ────────────────────────
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as UserNotification;
          setNotifications((prev) => [notif, ...prev].slice(0, 30));
          setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleClick = async (notif: UserNotification) => {
    if (!notif.is_read) {
      await notificationService.markRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (notif.action_url) {
      navigate(notif.action_url);
      setOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await notificationService.delete(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setUnreadCount((c) =>
      Math.max(0, c - (notifications.find((n) => n.id === id)?.is_read === false ? 1 : 0)),
    );
  };

  const displayCount = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div ref={wrapperRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-medium transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col gap-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center px-4">
                <Bell className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-sm font-medium text-slate-400">No notifications yet</p>
                <p className="text-xs text-slate-300 mt-1">
                  You'll be notified of important events here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`group relative flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${!notif.is_read ? 'bg-primary-50/40' : ''}`}
                  >
                    {/* Unread dot */}
                    {!notif.is_read && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary-500" />
                    )}

                    {/* Type icon */}
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${!notif.is_read ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                      <NotifIcon type={notif.type} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-tight truncate ${!notif.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {notif.title}
                      </p>
                      {notif.body && (
                        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {notif.body}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">{timeAgo(notif.created_at)}</p>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => handleDelete(e, notif.id)}
                      className="ml-1 shrink-0 rounded p-0.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-500 transition-all"
                      title="Dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2 text-center">
              <p className="text-[10px] text-slate-400">
                Showing last {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

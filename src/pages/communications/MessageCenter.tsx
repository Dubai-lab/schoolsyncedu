import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { messageService } from '@/services/notificationService';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import Dialog, { DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/Dialog';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Card } from '@/components/ui/Card';
import { Send, Inbox, ArrowRight, Mail, MailOpen } from 'lucide-react';
import { notify } from '@/components/shared/Toast';

export default function MessageCenter() {
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeForm, setComposeForm] = useState({ recipientId: '', subject: '', body: '' });

  const { data: inboxResult, isLoading: inboxLoading } = useFetch(
    ['messages-inbox', schoolId, userId, String(page), String(unreadOnly)],
    () => messageService.listInbox(schoolId, userId, { page, pageSize: 20, unreadOnly: unreadOnly || undefined }),
    { enabled: !!schoolId && tab === 'inbox' },
  );

  const { data: sentResult, isLoading: sentLoading } = useFetch(
    ['messages-sent', schoolId, userId, String(page)],
    () => messageService.listSent(schoolId, userId, { page, pageSize: 20 }),
    { enabled: !!schoolId && tab === 'sent' },
  );

  const markRead = useMutate(
    (id: string) => messageService.markRead(id),
    [['messages-inbox']],
  );

  const sendMessage = useMutate(
    () => messageService.send(schoolId, {
      sender_id: userId,
      recipient_id: composeForm.recipientId,
      subject: composeForm.subject,
      body: composeForm.body,
    }),
    [['messages-inbox'], ['messages-sent']],
    {
      onSuccess: () => {
        notify.success('Message sent');
        setShowCompose(false);
        setComposeForm({ recipientId: '', subject: '', body: '' });
      },
    },
  );

  const isLoading = tab === 'inbox' ? inboxLoading : sentLoading;
  const messages = tab === 'inbox' ? (inboxResult?.data ?? []) : (sentResult?.data ?? []);
  const totalCount = tab === 'inbox' ? (inboxResult?.count ?? 0) : (sentResult?.count ?? 0);
  const totalPages = Math.ceil(totalCount / 20);

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Communications', href: '/communications' }, { label: 'Messages' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Mail className="h-5 w-5" /> Messages
        </h1>
        <Button size="sm" onClick={() => setShowCompose(true)}>
          <Send className="h-4 w-4 mr-1" /> Compose
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        {(['inbox', 'sent'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t ? 'bg-white border border-b-0 border-slate-200 text-primary-700' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t === 'inbox' ? <><Inbox className="inline h-4 w-4 mr-1" /> Inbox</> : <><ArrowRight className="inline h-4 w-4 mr-1" /> Sent</>}
          </button>
        ))}
        {tab === 'inbox' && (
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-600 pr-2">
            <input type="checkbox" checked={unreadOnly}
              onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
            Unread only
          </label>
        )}
      </div>

      {/* Messages List */}
      {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

      {!isLoading && messages.length === 0 && (
        <Card className="p-8 text-center text-slate-500">No messages.</Card>
      )}

      <div className="space-y-2">
        {messages.map((msg) => {
          const msgAny = msg as unknown as Record<string, unknown>;
          const other = tab === 'inbox'
            ? msgAny.sender as Record<string, string> | null
            : msgAny.recipient as Record<string, string> | null;
          const otherName = other ? `${other.first_name} ${other.last_name}` : 'Unknown';

          return (
            <Card
              key={msg.id}
              className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                tab === 'inbox' && !msg.is_read ? 'border-l-4 border-l-primary-500 bg-primary-50/30' : ''
              }`}
              onClick={() => {
                if (tab === 'inbox' && !msg.is_read) markRead.mutate(msg.id);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {tab === 'inbox' && !msg.is_read ? (
                      <Mail className="h-4 w-4 text-primary-600 shrink-0" />
                    ) : (
                      <MailOpen className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                    <span className={`text-sm font-medium truncate ${!msg.is_read && tab === 'inbox' ? 'text-slate-900' : 'text-slate-700'}`}>
                      {msg.subject}
                    </span>
                    {tab === 'inbox' && !msg.is_read && <Badge variant="info" size="sm">New</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    {tab === 'inbox' ? 'From' : 'To'}: {otherName}
                  </p>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{msg.body}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{new Date(msg.created_at).toLocaleDateString()}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}

      {/* Compose Dialog */}
      <Dialog open={showCompose} onClose={() => setShowCompose(false)}>
        <DialogHeader><DialogTitle>New Message</DialogTitle></DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <Input label="Recipient ID *" value={composeForm.recipientId}
              onChange={(e) => setComposeForm((f) => ({ ...f, recipientId: e.target.value }))}
              placeholder="Enter recipient user ID" />
            <Input label="Subject *" value={composeForm.subject}
              onChange={(e) => setComposeForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="Message subject" />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message *</label>
              <textarea
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                rows={5} value={composeForm.body}
                onChange={(e) => setComposeForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Write your message…"
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
          <Button onClick={() => sendMessage.mutate(undefined)} loading={sendMessage.isPending}
            disabled={!composeForm.recipientId || !composeForm.subject || !composeForm.body}>
            <Send className="h-4 w-4 mr-1" /> Send
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
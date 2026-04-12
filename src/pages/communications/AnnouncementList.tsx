import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { announcementService } from '@/services/notificationService';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Plus, Megaphone, Send, Trash2, Mail, Bell } from 'lucide-react';

type AnnRow = {
  id: string;
  title: string;
  recipientGroup: string;
  createdBy: string;
  isPublished: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export default function AnnouncementList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const [page, setPage] = useState(1);
  const [pubFilter, setPubFilter] = useState<'' | 'true' | 'false'>('');

  const { data: result, isLoading } = useFetch(
    ['announcements', schoolId, String(page), pubFilter],
    () => announcementService.list(schoolId, {
      page, pageSize: 25,
      isPublished: pubFilter === '' ? undefined : pubFilter === 'true',
    }),
    { enabled: !!schoolId },
  );

  const publish = useMutate(
    (id: string) => announcementService.publish(id),
    [['announcements']],
  );

  const remove = useMutate(
    (id: string) => announcementService.delete(id),
    [['announcements']],
  );

  const rows: AnnRow[] = (result?.data ?? []).map((a) => {
    const creator = a.users;
    return {
      id: a.id,
      title: a.title,
      recipientGroup: a.recipient_group,
      createdBy: creator ? `${creator.first_name} ${creator.last_name}` : '',
      isPublished: a.is_published,
      publishedAt: a.published_at,
      expiresAt: a.expires_at,
      createdAt: a.created_at,
    };
  });

  const totalPages = Math.ceil((result?.count ?? 0) / 25);

  const columns: Column<AnnRow>[] = [
    { key: 'title', header: 'Title', render: (r) => <span className="font-medium text-slate-900">{r.title}</span> },
    { key: 'recipientGroup', header: 'Audience', render: (r) => (
      <Badge variant="info" size="sm">{r.recipientGroup}</Badge>
    )},
    { key: 'createdBy', header: 'Author', render: (r) => <span className="text-sm">{r.createdBy}</span> },
    { key: 'isPublished', header: 'Status', render: (r) => (
      r.isPublished
        ? <Badge variant="success" size="sm">Published</Badge>
        : <Badge variant="default" size="sm">Draft</Badge>
    )},
    { key: 'publishedAt', header: 'Published', render: (r) => (
      <span className="text-sm text-slate-500">{r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : '—'}</span>
    )},
    { key: 'expiresAt', header: 'Expires', render: (r) => (
      <span className="text-sm text-slate-500">{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : 'Never'}</span>
    )},
    { key: 'id', header: '', render: (r) => (
      <div className="flex gap-1">
        {!r.isPublished && (
          <Button size="sm" variant="outline" onClick={() => publish.mutate(r.id)} loading={publish.isPending}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => remove.mutate(r.id)}>
          <Trash2 className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Communications' }]} />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Megaphone className="h-5 w-5" /> Announcements
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/communications/messages')}>
            <Mail className="h-4 w-4 mr-1" /> Messages
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/communications/notifications')}>
            <Bell className="h-4 w-4 mr-1" /> Notifications
          </Button>
          <Button size="sm" onClick={() => navigate('/communications/announce')}>
            <Plus className="h-4 w-4 mr-1" /> New Announcement
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(['', 'true', 'false'] as const).map((v) => (
          <button key={v} onClick={() => { setPubFilter(v); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              pubFilter === v ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {v === '' ? 'All' : v === 'true' ? 'Published' : 'Drafts'}
          </button>
        ))}
      </div>

      <Table columns={columns} data={rows} keyExtractor={(r) => r.id} loading={isLoading} emptyMessage="No announcements yet." />

      {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}
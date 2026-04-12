import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMutate } from '@/hooks/useFetch';
import { announcementService } from '@/services/notificationService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { Send, Save } from 'lucide-react';
import { notify } from '@/components/shared/Toast';

const recipientOptions = [
  { label: 'All Users', value: 'all' },
  { label: 'Students', value: 'students' },
  { label: 'Teachers', value: 'teachers' },
  { label: 'Parents', value: 'parents' },
  { label: 'Staff', value: 'staff' },
  { label: 'Admin', value: 'admin' },
];

export default function SendAnnouncement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const schoolId = user?.school_id ?? '';
  const userId = user?.id ?? '';

  const [form, setForm] = useState({
    title: '',
    content: '',
    recipient_group: 'all',
    expires_at: '',
  });

  const createAnnouncement = useMutate(
    (publish: boolean) => announcementService.create(schoolId, {
      title: form.title,
      content: form.content,
      recipient_group: form.recipient_group,
      created_by: userId,
      is_published: publish,
      expires_at: form.expires_at || undefined,
    }),
    [['announcements']],
    {
      onSuccess: () => {
        notify.success('Announcement created');
        navigate('/communications');
      },
    },
  );

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canSubmit = form.title.trim() && form.content.trim();

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: 'Communications', href: '/communications' }, { label: 'New Announcement' }]} />

      <h1 className="text-xl font-bold text-slate-900">Create Announcement</h1>

      <Card className="p-6 max-w-2xl">
        <div className="space-y-4">
          <Input label="Title *" value={form.title} onChange={(e) => set('title', e.target.value)}
            placeholder="Announcement title" />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content *</label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[160px]"
              rows={6} value={form.content} onChange={(e) => set('content', e.target.value)}
              placeholder="Write your announcement…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="Audience" options={recipientOptions} value={form.recipient_group}
              onChange={(e) => set('recipient_group', e.target.value)} />
            <Input label="Expires On" type="date" value={form.expires_at}
              onChange={(e) => set('expires_at', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => createAnnouncement.mutate(false)}
              loading={createAnnouncement.isPending} disabled={!canSubmit}>
              <Save className="h-4 w-4 mr-1" /> Save as Draft
            </Button>
            <Button onClick={() => createAnnouncement.mutate(true)}
              loading={createAnnouncement.isPending} disabled={!canSubmit}>
              <Send className="h-4 w-4 mr-1" /> Publish Now
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
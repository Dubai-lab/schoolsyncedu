import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type {
  Announcement,
  Message,
  SmsLog,
} from '@/types/report.types';

// ==================== ANNOUNCEMENTS ====================

export const announcementService = {
  async list(
    schoolId: UUID,
    params: { page?: number; pageSize?: number; isPublished?: boolean } = {},
  ) {
    const { page = 1, pageSize = 25, isPublished } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('announcements')
      .select('*, users!announcements_created_by_fkey(id, first_name, last_name)', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (isPublished !== undefined) query = query.eq('is_published', isPublished);

    const { data, count, error } = await query;
    if (error) throw error;
    return {
      data: data as (Announcement & { users: Record<string, string> | null })[],
      count: count ?? 0,
    };
  },

  async getById(id: UUID) {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, users!announcements_created_by_fkey(id, first_name, last_name)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Announcement & { users: Record<string, string> | null };
  },

  async create(schoolId: UUID, entry: {
    title: string; content: string; recipient_group: string; created_by: UUID;
    is_published?: boolean; expires_at?: string;
  }) {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        school_id: schoolId,
        ...entry,
        is_published: entry.is_published ?? false,
        published_at: entry.is_published ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Announcement;
  },

  async publish(id: UUID) {
    const { data, error } = await supabase
      .from('announcements')
      .update({ is_published: true, published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Announcement;
  },

  async delete(id: UUID) {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) throw error;
  },
};

// ==================== MESSAGES ====================

export const messageService = {
  async listInbox(
    schoolId: UUID,
    userId: UUID,
    params: { page?: number; pageSize?: number; unreadOnly?: boolean } = {},
  ) {
    const { page = 1, pageSize = 25, unreadOnly } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(id, first_name, last_name)', { count: 'exact' })
      .eq('school_id', schoolId)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (unreadOnly) query = query.eq('is_read', false);

    const { data, count, error } = await query;
    if (error) throw error;
    return {
      data: data as (Message & { sender: Record<string, string> | null })[],
      count: count ?? 0,
    };
  },

  async listSent(
    schoolId: UUID,
    userId: UUID,
    params: { page?: number; pageSize?: number } = {},
  ) {
    const { page = 1, pageSize = 25 } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await supabase
      .from('messages')
      .select('*, recipient:users!messages_recipient_id_fkey(id, first_name, last_name)', { count: 'exact' })
      .eq('school_id', schoolId)
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return {
      data: data as (Message & { recipient: Record<string, string> | null })[],
      count: count ?? 0,
    };
  },

  async send(schoolId: UUID, entry: {
    sender_id: UUID; recipient_id: UUID; subject: string; body: string;
  }) {
    const { data, error } = await supabase
      .from('messages')
      .insert({ school_id: schoolId, ...entry, is_read: false })
      .select()
      .single();
    if (error) throw error;
    return data as Message;
  },

  async markRead(id: UUID) {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async getUnreadCount(schoolId: UUID, userId: UUID) {
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('recipient_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
  },
};

// ==================== IN-APP NOTIFICATIONS (bell) ====================

export type NotificationType =
  | 'grade_approval'
  | 'letter_approval'
  | 'new_application'
  | 'new_incident'
  | 'new_referral'
  | 'fee_overdue'
  | 'overdue_books'
  | 'subscription'
  | 'general';

export interface UserNotification {
  id: string;
  user_id: string;
  school_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationService = {
  /** Fetch recent notifications for a user (latest 30) */
  async list(userId: UUID): Promise<UserNotification[]> {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) throw error;
    return (data ?? []) as UserNotification[];
  },

  /** Count unread notifications */
  async unreadCount(userId: UUID): Promise<number> {
    const { count, error } = await supabase
      .from('user_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
  },

  /** Mark a single notification as read */
  async markRead(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) throw error;
  },

  /** Mark all notifications as read for a user */
  async markAllRead(userId: UUID): Promise<void> {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
  },

  /** Delete a notification */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('user_notifications')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /** Super admin bell: reads notification_logs (platform-wide email events) */
  async listForSuperAdmin(limit = 30): Promise<UserNotification[]> {
    const { data, error } = await supabase
      .from('notification_logs')
      .select('id, event_type, recipient_email, sent_at, metadata, school_id, schools(name)')
      .order('sent_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const eventTypeMap: Record<string, NotificationType> = {
      payment_confirmed:   'subscription',
      trial_ending:        'subscription',
      trial_expired:       'subscription',
      grace_period:        'subscription',
      suspended:           'subscription',
      reactivated:         'subscription',
      welcome:             'general',
    };

    const titleMap: Record<string, string> = {
      payment_confirmed:  'Payment Confirmed',
      trial_ending:       'Trial Ending Soon',
      trial_expired:      'Trial Expired',
      grace_period:       'Grace Period Started',
      suspended:          'School Suspended',
      reactivated:        'School Reactivated',
      welcome:            'New School Registered',
    };

    return (data ?? []).map((row: any) => ({
      id:         row.id,
      user_id:    '',
      school_id:  row.school_id ?? null,
      type:       eventTypeMap[row.event_type] ?? 'general',
      title:      titleMap[row.event_type] ?? row.event_type?.replace(/_/g, ' ') ?? 'Notification',
      body:       `${row.schools?.name ?? row.recipient_email} · ${row.recipient_email}`,
      action_url: '/admin/schools',
      is_read:    false,
      created_at: row.sent_at,
    })) as UserNotification[];
  },
};

// ==================== SMS LOGS ====================

export const smsLogService = {
  async list(
    schoolId: UUID,
    params: { page?: number; pageSize?: number; status?: string } = {},
  ) {
    const { page = 1, pageSize = 25, status } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('sms_logs')
      .select('*', { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as SmsLog[], count: count ?? 0 };
  },
};
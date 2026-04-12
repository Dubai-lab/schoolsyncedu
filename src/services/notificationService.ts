import { supabase } from '@/lib/supabase';
import type { UUID } from '@/types/common.types';
import type {
  Announcement,
  Message,
  Notification,
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

// ==================== NOTIFICATIONS ====================

export const notificationService = {
  async list(
    userId: UUID,
    params: { page?: number; pageSize?: number; unreadOnly?: boolean } = {},
  ) {
    const { page = 1, pageSize = 25, unreadOnly } = params;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (unreadOnly) query = query.eq('is_read', false);

    const { data, count, error } = await query;
    if (error) throw error;
    return { data: data as Notification[], count: count ?? 0 };
  },

  async markRead(id: UUID) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async markAllRead(userId: UUID) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
  },

  async getUnreadCount(userId: UUID) {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
    return count ?? 0;
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
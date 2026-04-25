-- Migration 082: Add is_read column to notification_logs
-- Allows super admin bell to persist read state across page refreshes.
-- The existing "notif_log_admin_all" RLS policy already grants super_admin
-- full access, so no policy changes are needed.

ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';

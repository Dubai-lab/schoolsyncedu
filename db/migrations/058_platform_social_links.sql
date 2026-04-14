-- Migration 058: Platform-level configuration (social media links)
-- A single-row table that stores global platform settings controlled by super_admin.

CREATE TABLE IF NOT EXISTS platform_config (
  id          TEXT        PRIMARY KEY DEFAULT 'singleton',  -- always one row
  social_x    TEXT,        -- X / Twitter URL
  social_facebook  TEXT,
  social_youtube   TEXT,
  social_instagram TEXT,
  social_tiktok    TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the singleton row so it always exists
INSERT INTO platform_config (id)
VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- Anyone (public site footer) can read
DROP POLICY IF EXISTS "platform_config_public_read" ON platform_config;
CREATE POLICY "platform_config_public_read" ON platform_config
  FOR SELECT USING (true);

-- Only super_admin can update
DROP POLICY IF EXISTS "platform_config_admin_update" ON platform_config;
CREATE POLICY "platform_config_admin_update" ON platform_config
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'super_admin')
  );

-- ============================================================
-- MIGRATION 008: SUPER ADMIN SUPPORT
-- Allow super_admin users to exist without a school_id
-- ============================================================

-- 1. Make school_id nullable on users table (super_admin is platform-level)
ALTER TABLE users ALTER COLUMN school_id DROP NOT NULL;

-- 2. Add a CHECK constraint: school_id is only nullable for super_admin
ALTER TABLE users ADD CONSTRAINT users_school_id_required
  CHECK (role = 'super_admin' OR school_id IS NOT NULL);

-- 3. Drop the existing UNIQUE(school_id, email) — it fails when school_id is NULL
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_school_id_email_key;

-- 4. Recreate as a unique index that handles NULLs properly
CREATE UNIQUE INDEX idx_users_unique_email_per_school
  ON users (COALESCE(school_id, '00000000-0000-0000-0000-000000000000'), email);

-- 5. Also allow super_admin to bypass RLS on all platform tables
-- (Already handled by is_super_admin() in 006 — no changes needed)

-- ============================================================
-- SEED: Create your first super admin
-- ============================================================
-- INSTRUCTIONS:
--   Step 1: Go to Supabase Dashboard > Authentication > Users > "Add User"
--           Email:    admin@eduliberia.com
--           Password: (choose a strong password)
--           Check "Auto Confirm"
--           Click "Create User" — copy the UUID shown
--
--   Step 2: Replace <AUTH_USER_UUID> below with that UUID, then run:
--
-- INSERT INTO public.users (id, auth_id, school_id, email, full_name, role, is_active)
-- VALUES (
--   gen_random_uuid(),
--   '<AUTH_USER_UUID>',       -- paste the UUID from Step 1
--   NULL,                     -- super_admin has no school
--   'admin@eduliberia.com',
--   'Platform Admin',
--   'super_admin',
--   true
-- );

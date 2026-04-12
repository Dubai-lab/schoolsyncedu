-- Migration 021: Add site_config JSONB for rich school landing page customization
-- Stores all flexible site design data (images, stats, programs, gallery, etc.)

ALTER TABLE schools ADD COLUMN IF NOT EXISTS site_config JSONB DEFAULT '{}'::jsonb;

-- Update the get_public_school_by_slug RPC to include site_config
CREATE OR REPLACE FUNCTION get_public_school_by_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school JSONB;
BEGIN
  SELECT to_jsonb(s) INTO v_school
  FROM schools s
  WHERE s.slug = p_slug AND s.site_published = TRUE;

  RETURN v_school;
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_school_by_slug TO anon;
GRANT EXECUTE ON FUNCTION get_public_school_by_slug TO authenticated;

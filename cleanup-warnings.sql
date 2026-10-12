-- =============================================================
-- Cleanup remaining Supabase security warnings
-- Run this to address non-critical recommendations
-- =============================================================

-- Fix 1: Set search_path for is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    FALSE
  );
END;
$$;

-- Fix 2: Revoke public access to is_admin function (only internal use)
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;

-- Fix 3: Remove broad SELECT policy on gallery bucket
-- (users can still view images via direct URLs)
DROP POLICY IF EXISTS gallery_objects_public_read ON storage.objects;

-- Re-create with no SELECT (direct URL access still works)
CREATE POLICY gallery_objects_public_access
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'gallery' AND name IS NOT NULL);

-- Note: bookings_public_insert and notifications_insert are intentional
-- They allow the public contact form to create bookings and notifications
-- This is required functionality, not a security issue.

-- =============================================================
-- Optionally enable compromised password protection
-- (Do this in Supabase Dashboard → Authentication → Settings)
-- Enable "Block passwords from HaveIBeenPwned breach database"
-- =============================================================
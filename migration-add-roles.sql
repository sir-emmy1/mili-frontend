-- =============================================================
-- Migration: Add role-based access control
-- Run this in Supabase SQL Editor to fix RLS warnings
-- =============================================================

-- Step 1: Create helper function to check admin role
create or replace function public.is_admin()
returns boolean as $$
begin
  return coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
    false
  );
end;
$$ language plpgsql security definer;

-- Step 2: Update RLS policies to use role check

-- Bookings
drop policy if exists bookings_admin_update on public.bookings;
create policy bookings_admin_update
  on public.bookings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists bookings_admin_delete on public.bookings;
create policy bookings_admin_delete
  on public.bookings for delete
  to authenticated
  using (public.is_admin());

-- Gallery
drop policy if exists gallery_admin_write on public.gallery_items;
create policy gallery_admin_write
  on public.gallery_items for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Packages
drop policy if exists packages_admin_write on public.packages;
create policy packages_admin_write
  on public.packages for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Todos
drop policy if exists todos_admin_all on public.todos;
create policy todos_admin_all
  on public.todos for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Notifications
drop policy if exists notifications_admin_update on public.notifications;
create policy notifications_admin_update
  on public.notifications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists notifications_admin_delete on public.notifications;
create policy notifications_admin_delete
  on public.notifications for delete
  to authenticated
  using (public.is_admin());

-- Settings
drop policy if exists settings_admin_write on public.settings;
create policy settings_admin_write
  on public.settings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Calendar notes
drop policy if exists calendar_notes_admin_all on public.calendar_notes;
create policy calendar_notes_admin_all
  on public.calendar_notes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists calendar_notes_student_read on public.calendar_notes;
create policy calendar_notes_student_read
  on public.calendar_notes for select
  to authenticated
  using (true);

-- Storage (gallery bucket)
drop policy if exists gallery_objects_admin_write on storage.objects;
create policy gallery_objects_admin_write
  on storage.objects for all
  to authenticated
  using (bucket_id = 'gallery' AND public.is_admin())
  with check (bucket_id = 'gallery' AND public.is_admin());

-- =============================================================
-- Step 3: Set roles for existing users
-- =============================================================
-- Run these commands in Supabase Dashboard → Authentication → Users
-- Click on each user → "Edit user" → scroll to "User Metadata"
-- Add this JSON:
--
-- For admin user:
--   {"role": "admin"}
--
-- For student user:
--   {"role": "student"}
--
-- Or run this SQL (replace email addresses):
--
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
-- WHERE email = 'Kiosh.7111@gmail.com';
--
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data || '{"role": "student"}'::jsonb
-- WHERE email = 'student@biephotography.com';
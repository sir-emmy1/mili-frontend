-- =============================================================
-- Emergency fix: Temporarily relax RLS while we fix the role system
-- This will let you use the admin dashboard again
-- =============================================================

-- Calendar notes: Allow all authenticated users to manage
DROP POLICY IF EXISTS calendar_notes_admin_all ON public.calendar_notes;
DROP POLICY IF EXISTS calendar_notes_student_read ON public.calendar_notes;

CREATE POLICY calendar_notes_all_access
  ON public.calendar_notes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Bookings: Allow authenticated to manage
DROP POLICY IF EXISTS bookings_admin_update ON public.bookings;
DROP POLICY IF EXISTS bookings_admin_delete ON public.bookings;

CREATE POLICY bookings_auth_update
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY bookings_auth_delete
  ON public.bookings FOR DELETE
  TO authenticated
  USING (true);

-- Gallery: Allow authenticated to manage
DROP POLICY IF EXISTS gallery_admin_write ON public.gallery_items;

CREATE POLICY gallery_auth_write
  ON public.gallery_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Packages: Allow authenticated to manage
DROP POLICY IF EXISTS packages_admin_write ON public.packages;

CREATE POLICY packages_auth_write
  ON public.packages FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Todos: Allow authenticated
DROP POLICY IF EXISTS todos_admin_all ON public.todos;

CREATE POLICY todos_auth_all
  ON public.todos FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Notifications: Allow authenticated to manage
DROP POLICY IF EXISTS notifications_admin_update ON public.notifications;
DROP POLICY IF EXISTS notifications_admin_delete ON public.notifications;

CREATE POLICY notifications_auth_update
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY notifications_auth_delete
  ON public.notifications FOR DELETE
  TO authenticated
  USING (true);

-- Settings: Allow authenticated
DROP POLICY IF EXISTS settings_admin_write ON public.settings;

CREATE POLICY settings_auth_write
  ON public.settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Storage: Allow authenticated to upload/delete
DROP POLICY IF EXISTS gallery_objects_admin_write ON storage.objects;

CREATE POLICY gallery_objects_auth_write
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'gallery')
  WITH CHECK (bucket_id = 'gallery');
-- Allow authenticated users to upload files to the order-files storage bucket.
-- Without this INSERT policy every client-side upload (WeddingNewspaperConstructor,
-- MagnetConstructor, CanvasPrintConstructor, CartoonPortraitConstructor,
-- DesignerOrderFlow) fails with an RLS violation. The SELECT policy remains
-- admin-only so customers cannot read each other's order files.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Authenticated users can upload order files'
  ) THEN
    CREATE POLICY "Authenticated users can upload order files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'order-files');
  END IF;
END $$;

-- Also ensure admins can read (idempotent guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Admins can read order files'
  ) THEN
    CREATE POLICY "Admins can read order files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'order-files'
      AND EXISTS (SELECT 1 FROM admin_users WHERE email = auth.jwt()->>'email')
    );
  END IF;
END $$;


CREATE POLICY "Authenticated users can upload to membros-fotos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'membros-fotos');

CREATE POLICY "Authenticated users can update membros-fotos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'membros-fotos');

CREATE POLICY "Anyone can read membros-fotos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'membros-fotos');

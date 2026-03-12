
ALTER TABLE public.tarefas_membros ADD COLUMN foto_url TEXT;

INSERT INTO storage.buckets (id, name, public) VALUES ('membros-fotos', 'membros-fotos', true);

CREATE POLICY "Users can upload member photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'membros-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update member photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'membros-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete member photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'membros-fotos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view member photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'membros-fotos');

-- Script de Correção Forçada para Configuração de Voz
-- Execute este script no SQL Editor do Supabase

BEGIN;

-- 1. Forçar criação da tabela voice_phrases
CREATE TABLE IF NOT EXISTS public.voice_phrases (
    id SERIAL PRIMARY KEY,
    phrase_text TEXT NOT NULL,
    sequence_order INTEGER NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS imediatamente
ALTER TABLE public.voice_phrases ENABLE ROW LEVEL SECURITY;

-- Recriar políticas de acesso (DROP para garantir que não duplique/erro)
DROP POLICY IF EXISTS "Authenticated users can view voice phrases" ON public.voice_phrases;
CREATE POLICY "Authenticated users can view voice phrases"
ON public.voice_phrases FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Staff can manage voice phrases" ON public.voice_phrases;
CREATE POLICY "Staff can manage voice phrases"
ON public.voice_phrases FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.staff WHERE id = auth.uid()));

-- Inserir frases (Upsert)
INSERT INTO public.voice_phrases (sequence_order, phrase_text)
VALUES 
    (1, 'O sistema de segurança está ativo'),
    (2, 'Minha voz é minha identidade'),
    (3, 'Autorização confirmada pelo motorista')
ON CONFLICT (sequence_order) DO UPDATE 
SET phrase_text = EXCLUDED.phrase_text;

-- 2. Garantir Bucket de Storage
-- Nota: A inserção direta na tabela storage.buckets pode falhar se não tiver permissão de superuser/postgres.
-- Se falhar, crie o bucket 'voice-recordings' manualmente pelo painel do Supabase (Menu Storage -> New Bucket).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-recordings', 'voice-recordings', false, 5242880, ARRAY['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- 3. Políticas de Storage (Garantia de permissão de upload)
DROP POLICY IF EXISTS "Users can upload own voice recordings" ON storage.objects;
CREATE POLICY "Users can upload own voice recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'voice-recordings' AND (storage.foldername(name))[1] = auth.uid()::text );

DROP POLICY IF EXISTS "Users can view own voice recordings" ON storage.objects;
CREATE POLICY "Users can view own voice recordings"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'voice-recordings' AND (storage.foldername(name))[1] = auth.uid()::text );

DROP POLICY IF EXISTS "Users can update own voice recordings" ON storage.objects;
CREATE POLICY "Users can update own voice recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'voice-recordings' AND (storage.foldername(name))[1] = auth.uid()::text );

COMMIT;

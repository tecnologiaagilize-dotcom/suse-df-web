-- 1. Tabela para as frases de configuração (Mensagens do Sistema)
CREATE TABLE IF NOT EXISTS voice_phrases (
    id SERIAL PRIMARY KEY,
    phrase_text TEXT NOT NULL,
    sequence_order INTEGER NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para voice_phrases
ALTER TABLE voice_phrases ENABLE ROW LEVEL SECURITY;

-- Política de leitura para todos (autenticados)
CREATE POLICY "Authenticated users can view voice phrases"
ON voice_phrases FOR SELECT
TO authenticated
USING (true);

-- Política de administração (apenas admin/staff)
CREATE POLICY "Staff can manage voice phrases"
ON voice_phrases FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));

-- Inserir as 3 frases padrão
INSERT INTO voice_phrases (phrase_text, sequence_order)
VALUES 
    ('O sistema de segurança está ativo', 1),
    ('Minha voz é minha identidade', 2),
    ('Autorização confirmada pelo motorista', 3)
ON CONFLICT (sequence_order) DO UPDATE 
SET phrase_text = EXCLUDED.phrase_text;


-- 2. Atualizar tabela users para guardar as URLs das gravações
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_biometry_1_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_biometry_2_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_biometry_3_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS secret_word_audio_url TEXT;


-- 3. Bucket de Storage para as gravações
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-recordings', 'voice-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para o bucket 'voice-recordings'

-- Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Users can upload own voice recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own voice recordings" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view all voice recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own voice recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own voice recordings" ON storage.objects;

-- INSERT: Apenas o próprio usuário (caminho deve começar com seu ID)
CREATE POLICY "Users can upload own voice recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
    bucket_id = 'voice-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text 
);

-- SELECT: Próprio usuário
CREATE POLICY "Users can view own voice recordings"
ON storage.objects FOR SELECT
TO authenticated
USING ( 
    bucket_id = 'voice-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text 
);

-- SELECT: Staff (para auditoria/verificação)
CREATE POLICY "Staff can view all voice recordings"
ON storage.objects FOR SELECT
TO authenticated
USING ( 
    bucket_id = 'voice-recordings' 
    AND EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()) 
);

-- UPDATE: Próprio usuário
CREATE POLICY "Users can update own voice recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING ( 
    bucket_id = 'voice-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text 
);

-- DELETE: Próprio usuário
CREATE POLICY "Users can delete own voice recordings"
ON storage.objects FOR DELETE
TO authenticated
USING ( 
    bucket_id = 'voice-recordings' 
    AND (storage.foldername(name))[1] = auth.uid()::text 
);

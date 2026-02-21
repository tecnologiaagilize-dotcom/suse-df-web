-- Script de Correção para Tabela voice_phrases
-- Execute este script no SQL Editor do Supabase para garantir que a tabela seja criada corretamente.

-- 1. Definir explicitamente o schema como public
SET search_path TO public;

-- 2. Criar a tabela se ela não existir
CREATE TABLE IF NOT EXISTS voice_phrases (
    id SERIAL PRIMARY KEY,
    phrase_text TEXT NOT NULL,
    sequence_order INTEGER NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Garantir permissões de acesso (Grants)
-- Isso é crucial para que a tabela apareça e seja acessível
GRANT ALL ON voice_phrases TO postgres;
GRANT ALL ON voice_phrases TO service_role;
GRANT SELECT ON voice_phrases TO anon;
GRANT SELECT ON voice_phrases TO authenticated;

-- 4. Habilitar RLS (Segurança a nível de linha)
ALTER TABLE voice_phrases ENABLE ROW LEVEL SECURITY;

-- 5. Recriar Políticas de Segurança (Policies)
DROP POLICY IF EXISTS "Authenticated users can view voice phrases" ON voice_phrases;
DROP POLICY IF EXISTS "Staff can manage voice phrases" ON voice_phrases;

-- Política de Leitura Pública (para usuários logados)
CREATE POLICY "Authenticated users can view voice phrases"
ON voice_phrases FOR SELECT
TO authenticated
USING (true);

-- Política de Escrita (apenas Staff/Admin)
CREATE POLICY "Staff can manage voice phrases"
ON voice_phrases FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));

-- 6. Inserir ou Atualizar as Frases Padrão
INSERT INTO voice_phrases (phrase_text, sequence_order)
VALUES 
    ('O sistema de segurança está ativo', 1),
    ('Minha voz é minha identidade', 2),
    ('Autorização confirmada pelo usuário', 3)
ON CONFLICT (sequence_order) DO UPDATE 
SET phrase_text = EXCLUDED.phrase_text;

-- 7. Retornar os dados para confirmar sucesso
SELECT * FROM voice_phrases ORDER BY sequence_order;

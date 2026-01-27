-- Script de Diagnóstico e Correção de Permissões de Update
-- Execute no SQL Editor do Supabase

-- 1. Remover políticas antigas de UPDATE para evitar conflitos
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can update their own profile" ON users;

-- 2. Recriar política de UPDATE permissiva para o próprio usuário
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Garantir que o usuário existe na tabela users (Auto-fix se faltar)
-- Este bloco é apenas ilustrativo, o frontend já tenta fazer isso, mas reforça a lógica.

-- 4. Verificar se a tabela users tem RLS habilitado (Deve ser TRUE)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 5. Garantir que as colunas JSONB aceitem NULL ou tenham valor default correto
ALTER TABLE users ALTER COLUMN address SET DEFAULT '{}'::jsonb;
ALTER TABLE users ALTER COLUMN emergency_contacts SET DEFAULT '[]'::jsonb;

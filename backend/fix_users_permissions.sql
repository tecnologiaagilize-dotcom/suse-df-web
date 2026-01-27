-- Script de Correção de Permissões para Tabela USERS
-- Execute no SQL Editor do Supabase

-- 1. Remover políticas existentes para evitar conflitos ou duplicidade
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can insert profile" ON users;

-- 2. Habilitar RLS (garantia)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 3. Criar Política de Inserção (Permitir que o usuário se cadastre)
CREATE POLICY "Users can insert their own profile" 
ON users FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 4. Criar Política de Leitura (Permitir que o usuário veja se já existe)
CREATE POLICY "Users can view own profile" 
ON users FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 5. Criar Política de Atualização
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- 6. Garantir que Staff possa ver os usuários (para o Dashboard funcionar)
DROP POLICY IF EXISTS "Staff can view all users" ON users;
CREATE POLICY "Staff can view all users" 
ON users FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

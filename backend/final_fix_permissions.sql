-- Script de Diagnóstico Final e Permissão Total (Debug)
-- Use APENAS se estiver tendo problemas de "Permission Denied" ou "RLS Policy"

-- 1. Habilitar RLS (Garantia)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Remover TODAS as políticas restritivas anteriores da tabela users
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can insert profile" ON users;
DROP POLICY IF EXISTS "Authenticated users can update their own profile" ON users;
DROP POLICY IF EXISTS "Staff can view all users" ON users;
DROP POLICY IF EXISTS "Staff can read all users" ON users;

-- 3. Criar políticas PERMISSIVAS (Permite que qualquer usuário autenticado faça tudo no SEU próprio registro)

-- INSERT: Permite criar se o ID bater com o Auth ID
CREATE POLICY "Enable insert for users based on user_id" ON "public"."users"
FOR INSERT WITH CHECK (auth.uid() = id);

-- UPDATE: Permite atualizar se o ID bater
CREATE POLICY "Enable update for users based on user_id" ON "public"."users"
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- SELECT: Permite ver o próprio perfil
CREATE POLICY "Enable read for users based on user_id" ON "public"."users"
FOR SELECT USING (auth.uid() = id);

-- SELECT (STAFF): Permite staff ver todos
CREATE POLICY "Enable read for staff" ON "public"."users"
FOR SELECT USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

-- 4. Garantir Grant de permissões básicas no esquema public
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

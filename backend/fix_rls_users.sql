-- Script para corrigir Permissões (RLS) na tabela USERS
-- Resolve o erro: "new row violates row-level security policy for table users"

-- Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 1. Política de LEITURA: Usuário vê apenas a si mesmo
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" 
ON public.users FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 2. Política de ATUALIZAÇÃO: Usuário edita apenas a si mesmo
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- 3. Política de INSERÇÃO: Usuário pode criar seu perfil
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" 
ON public.users FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 4. Permissão para STAFF ver usuários (para o painel administrativo funcionar)
DROP POLICY IF EXISTS "Staff can view all users" ON public.users;
CREATE POLICY "Staff can view all users" 
ON public.users FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.staff WHERE id = auth.uid())
);

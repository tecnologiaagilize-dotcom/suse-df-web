-- Relaxar restrições para permitir auto-criação de perfil de motorista
-- Resolve erro "Erro de integridade do cadastro"

-- 1. Permitir nulos em campos que podem ser preenchidos depois
ALTER TABLE public.users ALTER COLUMN cpf DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN cnh DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN matricula DROP NOT NULL;

-- 2. Garantir Políticas de RLS para Criação/Edição do Próprio Perfil
-- INSERT
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- UPDATE
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile"
ON public.users FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- SELECT (Garantir que ele possa ver o próprio perfil para checar se existe)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
TO authenticated
USING (auth.uid() = id);

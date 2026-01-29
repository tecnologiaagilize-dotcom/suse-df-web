-- Script para corrigir Permissões (RLS) na tabela STAFF
-- Resolve o erro de login "sem perfil" para Operadores

-- Habilitar RLS
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Permitir que qualquer usuário autenticado leia a tabela staff
-- Isso é necessário porque durante o login, precisamos buscar o perfil do usuário
-- para saber se ele é operador, supervisor, etc.
DROP POLICY IF EXISTS "Authenticated can view staff" ON public.staff;
CREATE POLICY "Authenticated can view staff" 
ON public.staff FOR SELECT 
TO authenticated 
USING (true);

-- Permitir que Admin/Master insira novos usuários (para a tela de Gestão de Usuários)
DROP POLICY IF EXISTS "Admins can insert staff" ON public.staff;
CREATE POLICY "Admins can insert staff" 
ON public.staff FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.staff 
    WHERE id = auth.uid() AND role IN ('admin', 'master', 'supervisor')
  )
);

-- Permitir que Admin/Master atualize usuários
DROP POLICY IF EXISTS "Admins can update staff" ON public.staff;
CREATE POLICY "Admins can update staff" 
ON public.staff FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.staff 
    WHERE id = auth.uid() AND role IN ('admin', 'master', 'supervisor')
  )
);

-- Script de Correção Completa: Schema + Permissões RLS para Chefe de Viatura

-- 1. SCHEMA: Garantir que as colunas existam
ALTER TABLE authorized_agents 
ADD COLUMN IF NOT EXISTS matricula TEXT,
ADD COLUMN IF NOT EXISTS posto_graduacao TEXT,
ADD COLUMN IF NOT EXISTS lotacao TEXT,
ADD COLUMN IF NOT EXISTS viatura TEXT,
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- 2. SEGURANÇA: Corrigir RLS (Row Level Security)
ALTER TABLE authorized_agents ENABLE ROW LEVEL SECURITY;

-- Remover política restritiva antiga (que exigia estar na tabela 'staff')
DROP POLICY IF EXISTS "Staff manage agents" ON authorized_agents;

-- Criar nova política permissiva: Qualquer usuário logado pode gerenciar agentes
-- Isso resolve o erro "new row violates row-level security policy"
CREATE POLICY "Authenticated users manage agents" 
ON authorized_agents 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. GRANTS: Garantir permissões de execução
GRANT ALL ON authorized_agents TO authenticated;
GRANT ALL ON authorized_agents TO service_role;

-- Confirmação
COMMENT ON TABLE authorized_agents IS 'Tabela de Agentes/Chefes de Viatura com RLS corrigido para usuários autenticados';

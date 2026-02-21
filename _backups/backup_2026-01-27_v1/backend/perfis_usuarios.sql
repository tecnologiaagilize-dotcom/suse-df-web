-- Script Consolidado para Perfis de Usuários (Staff)
-- Execute no SQL Editor do Supabase

-- 1. Inserir ou Atualizar o Usuário MASTER
-- Matrícula: 123456
-- Função: master (Acesso total + Gestão de usuários)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
    '123456@suse.sys', 
    'Usuário Master', 
    'master', 
    '123456', 
    true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'master', matricula = '123456', must_change_password = true;

-- 2. Inserir ou Atualizar o OPERADOR DE MESA
-- Matrícula: 000001
-- Função: operator (Atendimento básico de ocorrências)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
    '000001@suse.sys', 
    'Operador de Mesa', 
    'operator', 
    '000001', 
    true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'operator', matricula = '000001', must_change_password = true;

-- 3. Inserir ou Atualizar o CHEFE DE ATENDIMENTO
-- Matrícula: 000002
-- Função: supervisor (Gestão da equipe e relatórios operacionais)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
    '000002@suse.sys', 
    'Chefe de Atendimento', 
    'supervisor', 
    '000002', 
    true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'supervisor', matricula = '000002', must_change_password = true;

-- 4. Inserir ou Atualizar o SUPERVISOR DO SISTEMA
-- Matrícula: 000006
-- Função: admin (Configuração do sistema e auditoria)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
    '000006@suse.sys', 
    'Supervisor do Sistema', 
    'admin', 
    '000006', 
    true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'admin', matricula = '000006', must_change_password = true;

-- Nota: Lembre-se de criar estes mesmos usuários na aba 'Authentication' do Supabase
-- com a senha padrão 'teste123'.

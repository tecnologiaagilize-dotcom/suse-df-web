-- Script para atualizar matrículas e emails dos usuários de teste
-- Execute este script no SQL Editor do Supabase.

-- 1. Remover usuários antigos para evitar conflitos (opcional, mas recomendado para limpeza)
DELETE FROM staff WHERE matricula IN ('140001', '1400002', '1400003', '1400004');

-- 2. Master (Nova Matrícula 123456)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
  '123456@suse.sys', 
  'Usuário Master', 
  'master', 
  '123456', 
  true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'master', matricula = '123456';

-- 3. Operador de Mesa (Nova Matrícula 000001)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
  '000001@suse.sys', 
  'Operador de Mesa', 
  'operator', 
  '000001', 
  true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'operator', matricula = '000001';

-- 4. Chefe de Atendimento (Nova Matrícula 000002)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
  '000002@suse.sys', 
  'Chefe de Atendimento', 
  'supervisor', 
  '000002', 
  true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'supervisor', matricula = '000002';

-- 5. Supervisor do Sistema (Nova Matrícula 000006)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
  '000006@suse.sys', 
  'Supervisor do Sistema', 
  'admin', 
  '000006', 
  true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'admin', matricula = '000006';

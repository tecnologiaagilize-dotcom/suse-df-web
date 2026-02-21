-- Script para popular usuários de teste conforme regras do Caderno Técnico
-- Execute este script no SQL Editor do Supabase.
-- IMPORTANTE: Após executar este script, você deve criar os usuários no Authentication do Supabase 
-- com os emails listados abaixo e a senha 'teste123'.

-- 1. Master (Matrícula 140001)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
  '140001@suse.sys', 
  'Usuário Master', 
  'master', 
  '140001', 
  true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'master', matricula = '140001';

-- 2. Operador de Mesa de Atendimento (Matrícula 1400002)
-- Role: operator
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
  '1400002@suse.sys', 
  'Operador de Mesa', 
  'operator', 
  '1400002', 
  true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'operator', matricula = '1400002';

-- 3. Chefe de Atendimento (Matrícula 1400003)
-- Role: supervisor
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
  '1400003@suse.sys', 
  'Chefe de Atendimento', 
  'supervisor', 
  '1400003', 
  true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'supervisor', matricula = '1400003';

-- 4. Supervisor do Sistema (Matrícula 1400004)
-- Role: admin
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
  '1400004@suse.sys', 
  'Supervisor do Sistema', 
  'admin', 
  '1400004', 
  true
)
ON CONFLICT (email) DO UPDATE 
SET role = 'admin', matricula = '1400004';

-- Garantir constraint de unicidade para matrícula se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_matricula_key') THEN
        ALTER TABLE staff ADD CONSTRAINT staff_matricula_key UNIQUE (matricula);
    END IF;
END $$;

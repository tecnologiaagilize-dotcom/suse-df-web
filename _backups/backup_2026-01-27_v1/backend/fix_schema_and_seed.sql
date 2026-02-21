-- 1. Garantir que as colunas existem
ALTER TABLE staff ADD COLUMN IF NOT EXISTS matricula VARCHAR(50) UNIQUE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- 2. Garantir que o role 'master' existe no ENUM
DO $$
BEGIN
    ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'master';
EXCEPTION
    WHEN duplicate_object THEN null; -- Ignora se já existir
    WHEN OTHERS THEN null; -- Em alguns postgres antigos, IF NOT EXISTS não funciona em ADD VALUE, o exception pega
END $$;

-- 3. Limpar usuários de teste antigos (opcional, para evitar lixo)
DELETE FROM staff WHERE matricula IN ('140001', '1400002', '1400003', '1400004');

-- 4. Inserir Usuários com as Novas Matrículas

-- Master (123456)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES ('123456@suse.sys', 'Usuário Master', 'master', '123456', true)
ON CONFLICT (email) DO UPDATE SET role = 'master', matricula = '123456';

-- Operador de Mesa (000001)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES ('000001@suse.sys', 'Operador de Mesa', 'operator', '000001', true)
ON CONFLICT (email) DO UPDATE SET role = 'operator', matricula = '000001';

-- Chefe de Atendimento (000002)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES ('000002@suse.sys', 'Chefe de Atendimento', 'supervisor', '000002', true)
ON CONFLICT (email) DO UPDATE SET role = 'supervisor', matricula = '000002';

-- Supervisor do Sistema (000006)
INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES ('000006@suse.sys', 'Supervisor do Sistema', 'admin', '000006', true)
ON CONFLICT (email) DO UPDATE SET role = 'admin', matricula = '000006';

-- Script para configurar o usuário Master (Mastersuse)
-- 1. Execute este script no SQL Editor do Supabase para preparar a tabela staff.
-- 2. Depois, vá na aba Authentication > Users e crie um usuário com:
--    Email: mastersuse@suse.sys
--    Senha: teste123
--    (Isso vinculará o login à entrada criada abaixo)

INSERT INTO staff (email, name, role, matricula, must_change_password)
VALUES (
  'mastersuse@suse.sys', 
  'Administrador Master', 
  'master', 
  'mastersuse', 
  true -- Força troca de senha no primeiro login
)
ON CONFLICT (email) DO UPDATE 
SET 
  role = 'master',
  matricula = 'mastersuse',
  must_change_password = true;

-- Garantir que o email seja único na tabela staff para evitar conflitos
ALTER TABLE staff ADD CONSTRAINT staff_email_key UNIQUE (email);

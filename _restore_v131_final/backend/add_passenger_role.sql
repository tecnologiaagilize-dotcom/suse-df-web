-- Adicionar coluna 'role' na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'driver';

-- Atualizar usuários existentes para 'driver' (já é o default, mas garante)
UPDATE users SET role = 'driver' WHERE role IS NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

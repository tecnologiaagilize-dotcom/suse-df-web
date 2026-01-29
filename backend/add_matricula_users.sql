-- Adicionar coluna 'matricula' na tabela USERS (Motoristas)
-- Resolve erro "column users_1.matricula does not exist" no Dashboard Admin

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS matricula VARCHAR(20);

-- Indexar para busca rápida
CREATE INDEX IF NOT EXISTS idx_users_matricula ON public.users(matricula);

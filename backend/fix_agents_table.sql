-- Atualizar tabela de Agentes (Chefes de Viatura)
-- Resolve erro "Could not find the 'lotacao' column"

ALTER TABLE public.authorized_agents ADD COLUMN IF NOT EXISTS lotacao VARCHAR(100);
ALTER TABLE public.authorized_agents ADD COLUMN IF NOT EXISTS viatura VARCHAR(50);
ALTER TABLE public.authorized_agents ADD COLUMN IF NOT EXISTS posto_graduacao VARCHAR(50);
ALTER TABLE public.authorized_agents ADD COLUMN IF NOT EXISTS matricula VARCHAR(20);
ALTER TABLE public.authorized_agents ADD COLUMN IF NOT EXISTS observacoes TEXT;

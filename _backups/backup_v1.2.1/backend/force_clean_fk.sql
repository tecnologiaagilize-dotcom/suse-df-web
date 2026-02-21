-- SOLUÇÃO BRUTA PARA LIMPEZA DE DADOS E CORREÇÃO DE FK
-- Atenção: Isso apaga alertas de usuários inválidos.

BEGIN;

-- 1. Limpar tabela de localizações (Filha de Alertas)
DELETE FROM public.location_updates;

-- 2. Limpar tabela de tokens de compartilhamento (Filha de Alertas)
DELETE FROM public.share_links;

-- 3. Limpar tabela de relatórios (Filha de Alertas - se existir)
DELETE FROM public.incident_reports;

-- 4. Limpar tabela de alertas (Filha de Usuários)
DELETE FROM public.emergency_alerts;

-- 5. AGORA pode limpar usuários órfãos
DELETE FROM public.users WHERE id NOT IN (SELECT id FROM auth.users);

-- 6. Recriar a Foreign Key com CASCADE para evitar isso no futuro
ALTER TABLE public.emergency_alerts
DROP CONSTRAINT IF EXISTS emergency_alerts_user_id_fkey;

ALTER TABLE public.emergency_alerts
ADD CONSTRAINT emergency_alerts_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.users(id)
ON DELETE CASCADE;

COMMIT;

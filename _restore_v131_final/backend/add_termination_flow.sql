-- Script para Suportar Fluxo de Encerramento Verificado
-- Adiciona novo status e colunas de evidência

-- 1. Atualizar a restrição de status para incluir 'waiting_police_validation'
ALTER TABLE public.emergency_alerts DROP CONSTRAINT IF EXISTS emergency_alerts_status_check;

ALTER TABLE public.emergency_alerts ADD CONSTRAINT emergency_alerts_status_check 
CHECK (status IN ('active', 'investigating', 'resolved', 'cancelled', 'waiting_police_validation'));

-- 2. Adicionar colunas para evidências de encerramento
ALTER TABLE public.emergency_alerts ADD COLUMN IF NOT EXISTS termination_photo_url TEXT;
ALTER TABLE public.emergency_alerts ADD COLUMN IF NOT EXISTS termination_reason TEXT;
ALTER TABLE public.emergency_alerts ADD COLUMN IF NOT EXISTS termination_requested_at TIMESTAMP WITH TIME ZONE;

-- 3. Criar bucket para fotos de encerramento (se não existir)
-- Nota: Isso geralmente é feito via UI, mas garantimos a policy aqui se o bucket 'termination-evidence' existir
-- INSERT INTO storage.buckets (id, name) VALUES ('termination-evidence', 'termination-evidence') ON CONFLICT DO NOTHING;

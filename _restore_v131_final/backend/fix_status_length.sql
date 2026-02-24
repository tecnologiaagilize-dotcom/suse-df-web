-- Aumentar tamanho da coluna status para suportar 'waiting_police_validation' (25 chars)
-- Resolve erro "value too long for type character varying(20)"

ALTER TABLE public.emergency_alerts ALTER COLUMN status TYPE VARCHAR(50);

-- Atualizar a constraint de validação para garantir que o novo status seja aceito
ALTER TABLE public.emergency_alerts DROP CONSTRAINT IF EXISTS emergency_alerts_status_check;

ALTER TABLE public.emergency_alerts ADD CONSTRAINT emergency_alerts_status_check 
CHECK (status IN ('active', 'investigating', 'resolved', 'cancelled', 'waiting_police_validation'));

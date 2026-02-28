-- Atualização da tabela sos_events para suportar IRA-SUSI
-- Adiciona colunas para métricas de voz e trigger específico

ALTER TABLE public.sos_events 
ADD COLUMN IF NOT EXISTS voice_metrics jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ira_score numeric DEFAULT 0.0;

-- Atualizar enum de trigger_type se necessário (opcional, pois é text)
-- Mas garantindo que 'voice_ira' seja aceito na aplicação

COMMENT ON COLUMN public.sos_events.voice_metrics IS 'Métricas do IRA-SUSI no momento do disparo (Energia, Pitch, Jitter, Shimmer)';
COMMENT ON COLUMN public.sos_events.ira_score IS 'Score final do Índice de Risco Acústico (0.0 a 1.0)';

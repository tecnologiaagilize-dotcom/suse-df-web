-- Script Consolidado: Criação de Tabelas de Emergência e Suporte IRA-SUSI
-- Garante que a tabela sos_events exista antes de aplicar o patch

-- 1. Criar Tipo Enum sos_status se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sos_status') THEN 
        CREATE TYPE public.sos_status AS ENUM ('pending', 'acknowledged', 'in_progress', 'resolved', 'cancelled'); 
    END IF; 
END $$;

-- 2. Criar Tabela sos_events se não existir
CREATE TABLE IF NOT EXISTS public.sos_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trigger_type text NOT NULL, -- manual/auto_collision/voice/etc
    status public.sos_status NOT NULL DEFAULT 'pending',
    latitude numeric,
    longitude numeric,
    location_text text,
    patient_snapshot jsonb, -- snapshot mínimo no momento do SOS (crítico)
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Adicionar Colunas IRA-SUSI (Idempotente)
ALTER TABLE public.sos_events 
ADD COLUMN IF NOT EXISTS voice_metrics jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ira_score numeric DEFAULT 0.0;

-- 4. Comentários
COMMENT ON TABLE public.sos_events IS 'Registro de eventos de emergência (SOS)';
COMMENT ON COLUMN public.sos_events.voice_metrics IS 'Métricas do IRA-SUSI no momento do disparo (Energia, Pitch, Jitter, Shimmer)';
COMMENT ON COLUMN public.sos_events.ira_score IS 'Score final do Índice de Risco Acústico (0.0 a 1.0)';

-- 5. Índices e Triggers
CREATE INDEX IF NOT EXISTS idx_sos_user_time ON public.sos_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_status_time ON public.sos_events(status, created_at DESC);

-- Função de atualização de updated_at (se não existir)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sos_events_updated_at ON public.sos_events;
CREATE TRIGGER trg_sos_events_updated_at
BEFORE UPDATE ON public.sos_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Habilitar RLS
ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;

-- Política RLS: Usuário vê seus próprios eventos
DROP POLICY IF EXISTS "sos_events_select_own" ON public.sos_events;
CREATE POLICY "sos_events_select_own" ON public.sos_events
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Política RLS: Usuário pode criar eventos
DROP POLICY IF EXISTS "sos_events_insert_own" ON public.sos_events;
CREATE POLICY "sos_events_insert_own" ON public.sos_events
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

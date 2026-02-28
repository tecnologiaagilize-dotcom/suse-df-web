-- MÓDULO 09 - ÁUDIO LIVE (WebRTC)
-- Tabelas para suporte a streaming, gravação e auditoria de áudio

-- 1. Tabela de Ocorrências (Se já não existir, ou expandir sos_events)
-- Vamos assumir que sos_events é a base, mas criaremos uma tabela específica para gestão da sessão de áudio
CREATE TABLE IF NOT EXISTS public.audio_occurrences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_event_id uuid REFERENCES public.sos_events(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'active', -- active, closed, archived
    started_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz,
    retention_until timestamptz, -- Prazo legal de retenção
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Sessões de Áudio (Renovação a cada 45min)
CREATE TABLE IF NOT EXISTS public.audio_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    occurrence_id uuid NOT NULL REFERENCES public.audio_occurrences(id) ON DELETE CASCADE,
    session_token text NOT NULL, -- Token de controle (JWT ou Hash)
    started_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL, -- T+45min
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Segmentos de Áudio (Client-side e Server-side)
CREATE TABLE IF NOT EXISTS public.audio_segments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.audio_sessions(id) ON DELETE CASCADE,
    source_type text NOT NULL, -- 'client' ou 'server'
    file_path text NOT NULL, -- Caminho no Storage
    file_hash text NOT NULL, -- SHA-256 para integridade
    duration_seconds numeric,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Logs de Auditoria de Áudio
CREATE TABLE IF NOT EXISTS public.audio_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES public.audio_sessions(id) ON DELETE SET NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- Quem acessou/ouviu
    action text NOT NULL, -- 'start_stream', 'stop_stream', 'renew_session', 'playback'
    details jsonb,
    ip_address text,
    occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_audio_occ_sos ON public.audio_occurrences(sos_event_id);
CREATE INDEX IF NOT EXISTS idx_audio_sess_occ ON public.audio_sessions(occurrence_id);
CREATE INDEX IF NOT EXISTS idx_audio_seg_sess ON public.audio_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_audio_audit_sess ON public.audio_audit_logs(session_id);

-- RLS (Row Level Security)

ALTER TABLE public.audio_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (Exemplos Básicos - Refinar conforme perfil)

-- Ocorrências: Usuário dono do SOS vê, Profissionais autorizados veem
CREATE POLICY "audio_occ_select_own" ON public.audio_occurrences
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.sos_events 
        WHERE id = audio_occurrences.sos_event_id 
        AND user_id = auth.uid()
    )
    OR 
    EXISTS (
        SELECT 1 FROM public.professionals 
        WHERE auth_user_id = auth.uid() -- Corrigido para auth_user_id
    )
);

-- Sessões e Segmentos seguem a mesma lógica da ocorrência pai
CREATE POLICY "audio_sess_select_own" ON public.audio_sessions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.audio_occurrences 
        WHERE id = audio_sessions.occurrence_id
        AND (
            EXISTS (SELECT 1 FROM public.sos_events WHERE id = sos_event_id AND user_id = auth.uid())
            OR
            EXISTS (SELECT 1 FROM public.professionals WHERE auth_user_id = auth.uid())
        )
    )
);

-- Auditoria: Apenas inserção pelo sistema/backend, leitura restrita a admin/auditor
CREATE POLICY "audio_audit_insert" ON public.audio_audit_logs
FOR INSERT TO authenticated
WITH CHECK (true); -- Backend/Edge Functions inserem

CREATE POLICY "audio_audit_select_admin" ON public.audio_audit_logs
FOR SELECT TO authenticated
USING (
    public.is_admin() OR public.is_system()
);


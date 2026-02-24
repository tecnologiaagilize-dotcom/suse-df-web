-- MÓDULO 4: QR Code e Sessões (SAÚDE)
-- Dependências: Módulo 1 (Profiles), Módulo 3 (Profissionais)
-- Descrição: Geração de QR Codes e gestão de sessões de acesso temporário.

-- 1. Tabela QRCODES
CREATE TABLE IF NOT EXISTS public.qrcodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL, -- Hash do conteúdo visível (para validação)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE -- Opcional, para QR dinâmico
);

CREATE INDEX IF NOT EXISTS idx_qrcodes_profile ON public.qrcodes(profile_id);

-- RLS
ALTER TABLE public.qrcodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "QR: view own" ON public.qrcodes FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "QR: admin all" ON public.qrcodes FOR ALL TO authenticated USING (public.is_admin() OR public.is_system());


-- 2. Tabela QR_READ_SESSIONS (Sessões de Acesso Médico)
CREATE TABLE IF NOT EXISTS public.qr_read_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID REFERENCES public.professionals(id),
    profile_id UUID REFERENCES public.profiles(id),
    session_token TEXT NOT NULL, -- Token temporário para API
    access_level access_level DEFAULT 'basic',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.qr_read_sessions(session_token);

-- RLS
ALTER TABLE public.qr_read_sessions ENABLE ROW LEVEL SECURITY;
-- Profissional vê suas sessões ativas
CREATE POLICY "Session: prof view own" ON public.qr_read_sessions FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE id = qr_read_sessions.professional_id AND auth_user_id = auth.uid())
);
-- Paciente pode ver quem acessou seus dados (audit)
CREATE POLICY "Session: patient view logs" ON public.qr_read_sessions FOR SELECT TO authenticated USING (profile_id = auth.uid());


-- 3. RPC: Gerar/Rotacionar QR Code
CREATE OR REPLACE FUNCTION public.generate_qrcode()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_hash TEXT;
BEGIN
    -- Gera código aleatório (simulando conteúdo do QR)
    new_code := encode(gen_random_bytes(32), 'hex');
    code_hash := public.sha256_text(new_code);
    
    -- Inativa anteriores
    UPDATE public.qrcodes SET is_active = false WHERE profile_id = auth.uid();
    
    INSERT INTO public.qrcodes (profile_id, code_hash)
    VALUES (auth.uid(), code_hash);
    
    RETURN new_code; -- Retorna o código cru para o App exibir
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC: Iniciar Sessão (Leitura do QR pelo Médico)
-- Parâmetros: token do médico (credencial) + código lido do paciente
CREATE OR REPLACE FUNCTION public.start_qr_session(
    p_prof_credential_token TEXT,
    p_patient_qr_code TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_prof_id UUID;
    v_profile_id UUID;
    v_session_token TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_access_level access_level;
BEGIN
    -- 1. Validar Credencial do Profissional
    SELECT professional_id INTO v_prof_id
    FROM public.professional_credentials
    WHERE token_hash = public.sha256_text(p_prof_credential_token)
      AND expires_at > NOW()
      AND NOT revoked;
      
    IF v_prof_id IS NULL THEN
        RAISE EXCEPTION 'Credencial profissional inválida ou expirada.';
    END IF;
    
    -- 2. Validar QR Code do Paciente
    SELECT profile_id INTO v_profile_id
    FROM public.qrcodes
    WHERE code_hash = public.sha256_text(p_patient_qr_code)
      AND is_active = true;
      
    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION 'QR Code do paciente inválido ou inativo.';
    END IF;
    
    -- 3. Definir Nível de Acesso (Ex: Médico = Full, Socorrista = Basic)
    SELECT 
        CASE 
            WHEN type = 'doctor' THEN 'full'::access_level
            WHEN type = 'nurse' THEN 'advanced'::access_level
            ELSE 'basic'::access_level
        END INTO v_access_level
    FROM public.professionals WHERE id = v_prof_id;
    
    -- 4. Criar Sessão
    v_session_token := encode(gen_random_bytes(32), 'hex');
    v_expires_at := NOW() + INTERVAL '30 minutes'; -- Sessão curta
    
    INSERT INTO public.qr_read_sessions (professional_id, profile_id, session_token, access_level, expires_at)
    VALUES (v_prof_id, v_profile_id, v_session_token, v_access_level, v_expires_at);
    
    -- Retornar dados para o App do Médico
    RETURN jsonb_build_object(
        'session_token', v_session_token,
        'expires_at', v_expires_at,
        'access_level', v_access_level,
        'patient_id', v_profile_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

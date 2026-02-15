-- MÓDULO 6: Segurança Avançada (SAÚDE)
-- Dependências: Módulo 1 (Users/Profiles)
-- Descrição: Tabelas para MFA (Multi-Factor Authentication) e CAT (Context Aware Token).

-- 1. Tabela MFA_FACTORS
CREATE TABLE IF NOT EXISTS public.mfa_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    factor_type TEXT CHECK (factor_type IN ('totp', 'sms', 'email', 'backup_code')) NOT NULL,
    secret TEXT, -- Segredo criptografado (se TOTP) ou destino (se SMS/Email)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- RLS
ALTER TABLE public.mfa_factors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "MFA: view own" ON public.mfa_factors FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "MFA: manage own" ON public.mfa_factors FOR ALL TO authenticated USING (user_id = auth.uid());


-- 2. Tabela CAT_SESSIONS (Context Aware Token - Monitoramento de Risco)
CREATE TABLE IF NOT EXISTS public.cat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT, -- Hash do dispositivo (User-Agent + Canvas + etc)
    ip_address INET,
    risk_score INT DEFAULT 0, -- 0 (baixo) a 100 (crítico)
    is_blocked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.cat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "CAT: view own" ON public.cat_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "CAT: admin all" ON public.cat_sessions FOR ALL TO authenticated USING (public.is_admin() OR public.is_system());


-- 3. Tabela SECURITY_LOGS (Logs de Segurança Específicos)
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL, -- 'LOGIN_SUCCESS', 'LOGIN_FAIL', 'MFA_FAIL', 'SUSPICIOUS_IP'
    ip_address INET,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Imutabilidade
CREATE TRIGGER block_security_logs_update
    BEFORE UPDATE OR DELETE ON public.security_logs
    FOR EACH ROW EXECUTE FUNCTION public.block_update_delete();


-- 4. Função Helper: Registrar Evento de Segurança
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_user_id UUID,
    p_event TEXT,
    p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.security_logs (user_id, event_type, ip_address, details)
    VALUES (p_user_id, p_event, inet_client_addr(), p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

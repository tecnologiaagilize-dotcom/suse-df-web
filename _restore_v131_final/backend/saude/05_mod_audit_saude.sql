-- MÓDULO 5: Registros Clínicos e Auditoria (SAÚDE)
-- Dependências: Módulo 3 (Profissionais), Módulo 4 (QR Code)
-- Descrição: Prontuário eletrônico imutável e logs de auditoria de acesso.

-- 1. Tabela CLINICAL_RECORDS (Prontuário)
CREATE TABLE IF NOT EXISTS public.clinical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) NOT NULL,
    professional_id UUID REFERENCES public.professionals(id) NOT NULL,
    record_type TEXT NOT NULL, -- 'consultation', 'exam', 'procedure', 'vaccine', 'emergency'
    description TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb, -- [{ name, url, type }]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadados de Imutabilidade
    is_signed BOOLEAN DEFAULT false,
    signature_hash TEXT -- Assinatura digital do profissional (futuro)
);

-- Trigger de Imutabilidade (Ninguém edita registro clínico)
CREATE TRIGGER block_clinical_records_update
    BEFORE UPDATE OR DELETE ON public.clinical_records
    FOR EACH ROW EXECUTE FUNCTION public.block_update_delete();

-- RLS
ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;

-- Paciente vê seus registros
CREATE POLICY "Clinical: view own" ON public.clinical_records FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- Profissional vê registros dos pacientes que tem sessão ativa
CREATE POLICY "Clinical: prof view session" ON public.clinical_records FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.qr_read_sessions s
        WHERE s.professional_id = (SELECT id FROM public.professionals WHERE auth_user_id = auth.uid())
          AND s.profile_id = clinical_records.profile_id
          AND s.expires_at > NOW()
    )
);

-- Profissional cria registros (apenas para quem tem sessão ativa ou permissão)
CREATE POLICY "Clinical: prof insert session" ON public.clinical_records FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.qr_read_sessions s
        WHERE s.professional_id = (SELECT id FROM public.professionals WHERE auth_user_id = auth.uid())
          AND s.profile_id = clinical_records.profile_id
          AND s.expires_at > NOW()
    )
);


-- 2. Tabela ACCESS_AUDIT_LOGS (Auditoria de Saúde)
CREATE TABLE IF NOT EXISTS public.health_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id), -- Quem fez a ação (pode ser prof ou user)
    target_profile_id UUID REFERENCES public.profiles(id), -- Quem sofreu a ação
    resource_type TEXT NOT NULL, -- 'clinical_record', 'profile', 'qrcode'
    action_type TEXT NOT NULL, -- 'VIEW', 'CREATE', 'UPDATE', 'DELETE'
    details JSONB, -- O que foi alterado/visto
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Imutabilidade
CREATE TRIGGER block_health_audit_logs_update
    BEFORE UPDATE OR DELETE ON public.health_audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.block_update_delete();

-- RLS (Ninguém vê logs exceto Admin ou o próprio dono dos dados vendo quem acessou)
ALTER TABLE public.health_audit_logs ENABLE ROW LEVEL SECURITY;

-- Paciente vê quem acessou seus dados
CREATE POLICY "Audit: view my data access" ON public.health_audit_logs FOR SELECT TO authenticated USING (target_profile_id = auth.uid());

-- Admin vê tudo
CREATE POLICY "Audit: admin all" ON public.health_audit_logs FOR ALL TO authenticated USING (public.is_admin() OR public.is_system());


-- 3. Função Helper de Log
CREATE OR REPLACE FUNCTION public.log_health_access(
    p_target_id UUID,
    p_resource TEXT,
    p_action TEXT,
    p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.health_audit_logs (actor_id, target_profile_id, resource_type, action_type, details)
    VALUES (auth.uid(), p_target_id, p_resource, p_action, p_details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

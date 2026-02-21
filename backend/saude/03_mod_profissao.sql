-- MÓDULO 3: Profissionais (SAÚDE)
-- Dependências: Módulo 0 (Tipos), Módulo 1 (Profiles)
-- Descrição: Gestão de profissionais de saúde, verificação documental e credenciais.

-- 1. Tabela PROFESSIONALS
CREATE TABLE IF NOT EXISTS public.professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) NOT NULL, -- Link com login
    type professional_type NOT NULL, -- doctor, nurse, rescuer, admin
    council_number TEXT, -- CRM, COREN, etc.
    council_state VARCHAR(2), -- UF do conselho
    specialty TEXT,
    verification_status TEXT CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended')) DEFAULT 'pending',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(auth_user_id) -- Um usuário = Um perfil profissional
);

-- Trigger Updated_At
DROP TRIGGER IF EXISTS update_professionals_modtime ON public.professionals;
CREATE TRIGGER update_professionals_modtime
    BEFORE UPDATE ON public.professionals
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prof: view own" ON public.professionals FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Prof: update own" ON public.professionals FOR UPDATE TO authenticated USING (auth_user_id = auth.uid());
CREATE POLICY "Prof: admin all" ON public.professionals FOR ALL TO authenticated USING (public.is_admin() OR public.is_system());


-- 2. Tabela PROFESSIONAL_DOCUMENTS
CREATE TABLE IF NOT EXISTS public.professional_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'diploma', 'council_card', 'id_front', 'id_back'
    file_path TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.professional_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Docs: view own" ON public.professional_documents FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.professionals WHERE id = professional_documents.professional_id AND auth_user_id = auth.uid())
);
CREATE POLICY "Docs: insert own" ON public.professional_documents FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.professionals WHERE id = professional_documents.professional_id AND auth_user_id = auth.uid())
);
CREATE POLICY "Docs: admin all" ON public.professional_documents FOR ALL TO authenticated USING (public.is_admin() OR public.is_system());


-- 3. Tabela PROFESSIONAL_CREDENTIALS (Tokens de Acesso/Carteira)
CREATE TABLE IF NOT EXISTS public.professional_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL, -- Armazenar apenas hash (SHA256)
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revocation_reason TEXT
);

-- RLS
ALTER TABLE public.professional_credentials ENABLE ROW LEVEL SECURITY;
-- Profissionais não veem os hashes, apenas se está ativo/válido (via view ou RPC)
CREATE POLICY "Creds: admin all" ON public.professional_credentials FOR ALL TO authenticated USING (public.is_admin() OR public.is_system());


-- 4. RPCs Básicas

-- RPC: Registrar Profissional
CREATE OR REPLACE FUNCTION public.professional_register(
    p_type professional_type,
    p_council_number TEXT,
    p_council_state VARCHAR,
    p_specialty TEXT
)
RETURNS UUID AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO public.professionals (auth_user_id, type, council_number, council_state, specialty)
    VALUES (auth.uid(), p_type, p_council_number, p_council_state, p_specialty)
    RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Admin Aprovar/Rejeitar
CREATE OR REPLACE FUNCTION public.admin_set_professional_status(
    p_prof_id UUID,
    p_status TEXT,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    PERFORM public.assert_admin();
    
    UPDATE public.professionals
    SET verification_status = p_status
    WHERE id = p_prof_id;
    
    -- Opcional: Logar motivo em tabela de auditoria (Módulo 5)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Emitir Credencial (Gera token, salva hash, retorna token)
CREATE OR REPLACE FUNCTION public.issue_professional_credential(
    p_prof_id UUID,
    p_validity_days INT DEFAULT 365
)
RETURNS TEXT AS $$
DECLARE
    raw_token TEXT;
    token_hash TEXT;
BEGIN
    PERFORM public.assert_admin();
    
    -- Gerar token aleatório seguro (32 chars)
    raw_token := encode(gen_random_bytes(24), 'base64');
    token_hash := public.sha256_text(raw_token);
    
    INSERT INTO public.professional_credentials (professional_id, token_hash, expires_at)
    VALUES (p_prof_id, token_hash, NOW() + (p_validity_days || ' days')::INTERVAL);
    
    RETURN raw_token; -- Retorna apenas uma vez!
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

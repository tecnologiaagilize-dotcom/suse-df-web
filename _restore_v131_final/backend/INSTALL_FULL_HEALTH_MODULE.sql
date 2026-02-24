-- MÓDULO 0: Preparação do Ambiente (SAÚDE)
-- Autor: Trae AI
-- Data: 2026-02-14
-- Descrição: Configuração inicial de extensões, tipos e funções base.

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- 2. Tipos ENUM (Baseados na documentação de Saúde)
DO $$ BEGIN
    CREATE TYPE professional_type AS ENUM ('doctor', 'nurse', 'rescuer', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE access_level AS ENUM ('basic', 'medium', 'advanced', 'full');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Função de Atualização de Timestamp (Trigger)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Funções de Verificação de Permissão (Helpers para RLS)
-- Verifica se o usuário atual é admin ou master na tabela staff
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = auth.uid() 
    AND role IN ('admin', 'master')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica se o usuário é do sistema (service_role)
CREATE OR REPLACE FUNCTION public.is_system()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica role do JWT ou se é superuser (opcional)
  RETURN (auth.jwt() ->> 'role') = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper para Hash SHA256 (Wrapper para pgcrypto)
CREATE OR REPLACE FUNCTION public.sha256_text(text_to_hash TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(text_to_hash, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Função de Bloqueio de Update/Delete (Imutabilidade)
CREATE OR REPLACE FUNCTION public.block_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Updates and deletions are not allowed on this table (Immutable Log).';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Helpers de Assert (Para RPCs)
CREATE OR REPLACE FUNCTION public.assert_authenticated()
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() AND NOT public.is_system() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- MÓDULO 1: Perfis de Usuários (SAÚDE)
-- Dependências: Módulo 0
-- Descrição: Tabela central de perfil civil/pessoal para o sistema de saúde.

-- 1. Tabela PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    social_name TEXT,
    cpf CITEXT UNIQUE, -- Requer extensão citext (Módulo 0)
    birth_date DATE,
    gender TEXT CHECK (gender IN ('M', 'F', 'O', 'N')), -- Masculino, Feminino, Outro, Não informar
    blood_type TEXT CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN')),
    address JSONB DEFAULT '{}'::jsonb, -- { rua, numero, bairro, cidade, uf, cep, complemento }
    contacts JSONB DEFAULT '[]'::jsonb, -- [{ tipo: 'celular', valor: '...' }, { tipo: 'email', valor: '...' }]
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Trigger de Updated_At
DROP TRIGGER IF EXISTS update_profiles_modtime ON public.profiles;
CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Usuário vê seu próprio perfil
CREATE POLICY "Profiles: view own" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Policy: Usuário edita seu próprio perfil
CREATE POLICY "Profiles: update own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Policy: Usuário insere seu próprio perfil (geralmente via trigger, mas útil permitir)
CREATE POLICY "Profiles: insert own" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- Policy: Admins e Sistema veem tudo
CREATE POLICY "Profiles: admin view all" ON public.profiles
    FOR SELECT TO authenticated
    USING (public.is_admin() OR public.is_system());

CREATE POLICY "Profiles: admin update all" ON public.profiles
    FOR UPDATE TO authenticated
    USING (public.is_admin() OR public.is_system());

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf);

-- MÓDULO 2: Dados de Saúde (SAÚDE)
-- Dependências: Módulo 1 (Profiles)
-- Descrição: Tabelas para armazenamento de dados clínicos básicos do usuário.

-- 1. Tabela HEALTH_PROFILES (Dados Gerais)
CREATE TABLE IF NOT EXISTS public.health_profiles (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    sus_card TEXT,
    health_insurance JSONB DEFAULT '{}'::jsonb, -- { nome, numero, plano, validade }
    organ_donor BOOLEAN DEFAULT false,
    additional_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger Updated_At
DROP TRIGGER IF EXISTS update_health_profiles_modtime ON public.health_profiles;
CREATE TRIGGER update_health_profiles_modtime
    BEFORE UPDATE ON public.health_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Health: view own" ON public.health_profiles FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Health: update own" ON public.health_profiles FOR UPDATE TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Health: insert own" ON public.health_profiles FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Health: admin all" ON public.health_profiles FOR ALL TO authenticated USING (public.is_admin() OR public.is_system());


-- 2. Tabela ALLERGIES (Alergias)
CREATE TABLE IF NOT EXISTS public.allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    allergen TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('mild', 'moderate', 'severe', 'unknown')),
    reaction TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allergies: view own" ON public.allergies FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Allergies: manage own" ON public.allergies FOR ALL TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Allergies: admin all" ON public.allergies FOR ALL TO authenticated USING (public.is_admin() OR public.is_system());


-- 3. Tabela MEDICATIONS (Medicamentos)
CREATE TABLE IF NOT EXISTS public.medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    is_continuous BOOLEAN DEFAULT false,
    started_at DATE,
    ended_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Medications: view own" ON public.medications FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Medications: manage own" ON public.medications FOR ALL TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Medications: admin all" ON public.medications FOR ALL TO authenticated USING (public.is_admin() OR public.is_system());


-- 4. Tabela CONDITIONS (Condições/Doenças)
CREATE TABLE IF NOT EXISTS public.conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cid_code TEXT,
    diagnosis_date DATE,
    status TEXT CHECK (status IN ('active', 'treated', 'controlled', 'unknown')) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Conditions: view own" ON public.conditions FOR SELECT TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Conditions: manage own" ON public.conditions FOR ALL TO authenticated USING (profile_id = auth.uid());
CREATE POLICY "Conditions: admin all" ON public.conditions FOR ALL TO authenticated USING (public.is_admin() OR public.is_system());

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

-- MÓDULO 7: Acesso Público de Emergência (Health Check)
-- Descrição: Permite a leitura de dados vitais através do QR Code sem login.
-- ESTRATÉGIA: Usamos o ID (UUID) da tabela qrcodes como token público.

-- RPC: Obter Dados de Saúde Públicos (Emergência)
-- Parâmetros: token (UUID da tabela qrcodes)
-- Retorno: JSON com dados vitais.

CREATE OR REPLACE FUNCTION public.get_public_health_info(p_token UUID)
RETURNS JSONB AS $$
DECLARE
    v_profile_id UUID;
    v_data JSONB;
BEGIN
    -- 1. Validar Token (ID)
    SELECT profile_id INTO v_profile_id
    FROM public.qrcodes
    WHERE id = p_token
      AND is_active = true;

    IF v_profile_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'QR Code não encontrado ou inativo.');
    END IF;

    -- 2. Buscar Dados Agregados
    SELECT jsonb_build_object(
        'success', true,
        'generated_at', NOW(),
        'personal', (
            SELECT row_to_json(p) 
            FROM (
                SELECT full_name, social_name, birth_date, blood_type, gender 
                FROM public.profiles 
                WHERE id = v_profile_id
            ) p
        ),
        'health', (
            SELECT row_to_json(h) 
            FROM (
                SELECT sus_card, organ_donor, additional_notes, health_insurance 
                FROM public.health_profiles 
                WHERE profile_id = v_profile_id
            ) h
        ),
        'allergies', COALESCE((
            SELECT json_agg(a) 
            FROM (
                SELECT allergen, severity 
                FROM public.allergies 
                WHERE profile_id = v_profile_id
            ) a
        ), '[]'::json),
        'medications', COALESCE((
            SELECT json_agg(m) 
            FROM (
                SELECT name, dosage, frequency, notes 
                FROM public.medications 
                WHERE profile_id = v_profile_id
            ) m
        ), '[]'::json),
        'emergency_contacts', (
            SELECT emergency_contacts 
            FROM public.users 
            WHERE id = v_profile_id
        )
    ) INTO v_data;

    RETURN v_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_public_health_info(UUID) TO anon, authenticated, service_role;

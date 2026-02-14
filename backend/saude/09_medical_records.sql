-- MÓDULO 9: Prontuário Eletrônico (Histórico Médico)
-- Dependências: Módulo 1 (Profiles), Módulo 2 (Saúde)
-- Descrição: Armazena o histórico de atendimentos realizados por profissionais.

-- 1. Tabela MEDICAL_RECORDS (Prontuário)
CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- ID do médico/socorrista
    type TEXT NOT NULL CHECK (type IN ('Emergência', 'Consulta Ambulatorial', 'Retorno', 'Exame', 'Cirurgia')),
    subject TEXT NOT NULL, -- Motivo principal (ex: Dor no peito, Checkup)
    description TEXT, -- Evolução clínica detalhada
    vitals JSONB DEFAULT '{}'::jsonb, -- { bp: '120/80', hr: 72, temp: 36.5, spo2: 98 }
    prescription TEXT, -- Receituário simples (texto)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger Updated_At
CREATE TRIGGER update_medical_records_modtime
    BEFORE UPDATE ON public.medical_records
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. RLS (Row Level Security)
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

-- Política 1: Paciente pode VER seus próprios registros
CREATE POLICY "MedicalRecords: view own" 
ON public.medical_records FOR SELECT 
TO authenticated 
USING (patient_id = auth.uid());

-- Política 2: Profissionais podem VER todos os registros (Simplificação MVP)
-- Idealmente, seria apenas se tivesse vínculo com o paciente, mas no MVP o profissional tem acesso amplo.
-- Assumimos que existe uma role 'professional' ou verificamos na tabela de users.
-- Como o Supabase Auth usa roles no JWT, podemos checar auth.jwt() -> role ou app_metadata.
-- Para simplificar, vamos permitir que qualquer usuário autenticado com perfil de 'professional' veja.
-- (Vou usar uma função auxiliar is_professional() se existir, ou checar metadata)

-- Vamos criar uma função auxiliar para checar se é profissional
CREATE OR REPLACE FUNCTION public.is_professional()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica se o usuário tem a claim 'role' = 'professional' ou 'admin'
  -- Ou verifica na tabela de perfis se tiver um campo de tipo (ainda não temos, vamos usar metadata)
  RETURN (
    auth.jwt() ->> 'role' = 'service_role' OR -- Admin
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) IN ('professional', 'admin', 'master', 'socorrista')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "MedicalRecords: professional view all" 
ON public.medical_records FOR SELECT 
TO authenticated 
USING (public.is_professional());

-- Política 3: Profissionais podem INSERIR registros
CREATE POLICY "MedicalRecords: professional insert" 
ON public.medical_records FOR INSERT 
TO authenticated 
WITH CHECK (public.is_professional());

-- Política 4: Profissionais podem ATUALIZAR seus próprios registros (dentro de 24h - regra de negócio opcional)
CREATE POLICY "MedicalRecords: professional update own" 
ON public.medical_records FOR UPDATE 
TO authenticated 
USING (professional_id = auth.uid() AND public.is_professional());

-- 3. Função RPC para buscar histórico completo de um paciente (usada no PatientRecord.jsx)
CREATE OR REPLACE FUNCTION public.get_patient_history(p_patient_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_records JSONB;
BEGIN
    -- Verifica permissão (apenas profissionais ou o próprio paciente)
    IF (auth.uid() != p_patient_id AND NOT public.is_professional()) THEN
        RAISE EXCEPTION 'Acesso negado ao histórico médico.';
    END IF;

    SELECT json_agg(
        json_build_object(
            'id', r.id,
            'date', r.created_at,
            'type', r.type,
            'subject', r.subject,
            'description', r.description,
            'vitals', r.vitals,
            'prescription', r.prescription,
            'doctor', COALESCE(p.full_name, 'Profissional não identificado')
        ) ORDER BY r.created_at DESC
    ) INTO v_records
    FROM public.medical_records r
    LEFT JOIN public.profiles p ON r.professional_id = p.id
    WHERE r.patient_id = p_patient_id;

    RETURN COALESCE(v_records, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

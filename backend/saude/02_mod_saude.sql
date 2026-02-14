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

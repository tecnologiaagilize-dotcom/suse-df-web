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

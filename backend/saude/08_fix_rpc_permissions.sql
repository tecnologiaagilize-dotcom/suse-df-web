-- MÓDULO 8: Correção de Permissões RPC
-- Descrição: Reforça as permissões para a função pública de saúde
-- Autor: Trae AI
-- Data: 2026-02-14

-- 1. Recria a função para garantir o SECURITY DEFINER
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

    -- 3. Logar Acesso (Auditoria) - Opcional se falhar
    BEGIN
        INSERT INTO public.health_audit_logs (
            actor_id, 
            target_profile_id, 
            resource_type, 
            action_type, 
            details,
            user_agent
        )
        VALUES (
            NULL, 
            v_profile_id, 
            'qrcode', 
            'VIEW', 
            jsonb_build_object('method', 'public_scan', 'token', p_token),
            'Public Access'
        );
    EXCEPTION WHEN OTHERS THEN
        -- Ignora erro de auditoria para não bloquear o acesso vital
        RAISE NOTICE 'Erro ao auditar: %', SQLERRM;
    END;

    RETURN v_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Concede permissão explícita para o papel 'anon' (público)
GRANT EXECUTE ON FUNCTION public.get_public_health_info(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_health_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_health_info(UUID) TO service_role;

-- 3. Garante acesso de leitura na tabela qrcodes para anon via RLS (Backup caso RPC falhe em algum contexto)
-- Nota: Como usamos SECURITY DEFINER, isso teoricamente não é necessário para a RPC, 
-- mas ajuda se o Supabase client tentar fazer algum pre-flight.
ALTER TABLE public.qrcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública de QR Codes ativos" 
ON public.qrcodes FOR SELECT 
TO anon, authenticated
USING (is_active = true);

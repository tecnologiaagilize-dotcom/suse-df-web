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

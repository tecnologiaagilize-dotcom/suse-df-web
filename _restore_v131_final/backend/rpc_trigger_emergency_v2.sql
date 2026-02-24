CREATE OR REPLACE FUNCTION trigger_emergency_rpc(
    p_trigger_type TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_existing_alert RECORD;
    v_new_alert RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    -- 1. Verificar se JÁ EXISTE uma ocorrência ativa para este usuário
    SELECT id, status, created_at 
    INTO v_existing_alert
    FROM public.emergency_alerts 
    WHERE user_id = v_user_id 
      AND status IN ('active', 'acknowledged') -- Considera ativa se estiver 'active' ou 'acknowledged'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Se já existe, NÃO cria nova. Retorna a existente com flag 'already_active'
    IF v_existing_alert IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Já existe uma ocorrência em andamento.',
            'alert', jsonb_build_object(
                'id', v_existing_alert.id,
                'status', v_existing_alert.status,
                'created_at', v_existing_alert.created_at
            ),
            'already_active', true
        );
    END IF;

    -- 2. Auto-healing: Garantir perfil
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id) THEN
        INSERT INTO public.users (id, email, name, secret_word)
        VALUES (
            v_user_id, 
            (SELECT email FROM auth.users WHERE id = v_user_id), 
            'Motorista', 
            'socorro'
        );
    END IF;

    -- 3. Criar NOVO Alerta (se não houver ativo)
    INSERT INTO public.emergency_alerts (
        user_id, 
        status, 
        trigger_type, 
        initial_lat, 
        initial_lng, 
        notes
    )
    VALUES (
        v_user_id, 
        'active', 
        p_trigger_type, 
        p_latitude, 
        p_longitude, 
        p_notes
    )
    RETURNING id, status, created_at INTO v_new_alert;

    RETURN jsonb_build_object(
        'success', true,
        'alert', jsonb_build_object(
            'id', v_new_alert.id,
            'status', v_new_alert.status,
            'created_at', v_new_alert.created_at
        )
    );
END;
$$;

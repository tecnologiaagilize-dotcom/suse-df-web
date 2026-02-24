-- Função RPC para substituir a Edge Function trigger-emergency
-- Permite que o usuário crie alertas de emergência via SQL puro, sem precisar de deploy via CLI.

CREATE OR REPLACE FUNCTION trigger_emergency_rpc(
    p_trigger_type TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com permissões de sistema (bypassa RLS se necessário, mas seguro aqui)
AS $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_user_meta JSONB;
    v_new_alert RECORD;
BEGIN
    -- 1. Pegar usuário logado
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    -- Tenta pegar email/meta se disponível (opcional)
    -- Em PLPGSQL puro acesso a auth.users é restrito, então confiamos no auth.uid()

    -- 2. Auto-healing: Garantir que o perfil existe na tabela pública users
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id) THEN
        -- Tenta inserir um perfil básico
        INSERT INTO public.users (id, email, name, secret_word)
        VALUES (
            v_user_id, 
            (SELECT email FROM auth.users WHERE id = v_user_id), 
            'Motorista (Auto)', 
            'socorro'
        );
    END IF;

    -- 3. Criar o Alerta de Emergência
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

    -- 4. Retornar objeto JSON compatível com o frontend
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

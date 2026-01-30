-- Atualização da RPC de validação para suportar dados detalhados do oficial
-- Arquivo: backend/UPDATE_VALIDATION_RPC.sql

CREATE OR REPLACE FUNCTION validate_termination_token(
  p_alert_id UUID, 
  p_token_input TEXT, 
  p_rank TEXT,
  p_name TEXT,
  p_matricula TEXT,
  p_phone TEXT,
  p_battalion TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alert RECORD;
  v_input_hash TEXT;
  v_officer_info TEXT;
BEGIN
  -- Buscar dados do alerta
  SELECT * INTO v_alert 
  FROM public.emergency_alerts 
  WHERE id = p_alert_id;

  -- Validações Prévias
  IF v_alert.status != 'waiting_police_validation' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Alerta não está aguardando validação.');
  END IF;

  IF v_alert.termination_token_expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Token expirado. Solicite ao usuário gerar um novo.');
  END IF;

  IF v_alert.termination_token_attempts >= 3 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Número máximo de tentativas excedido. Bloqueado.');
  END IF;

  -- Calcular Hash do Input (Sanitização: Upper e Trim já vêm do front, mas reforçamos)
  v_input_hash := encode(digest(upper(trim(p_token_input)) || v_alert.termination_token_salt, 'sha256'), 'hex');

  -- Comparar Hashes
  IF v_input_hash = v_alert.termination_token_hash THEN
    -- SUCESSO: Token Válido
    
    -- Formatar string do oficial para registro simples
    v_officer_info := p_rank || ' ' || p_name || ' (Mat: ' || p_matricula || ') - ' || p_battalion || ' - Tel: ' || p_phone;

    UPDATE public.emergency_alerts
    SET 
      status = 'resolved',
      resolved_at = NOW(),
      validating_police_officer = v_officer_info, -- Salva a string formatada
      notes = COALESCE(notes, '') || E'\n[Validação Policial] Encerrado via Token por: ' || v_officer_info
    WHERE id = p_alert_id;

    RETURN jsonb_build_object('success', true, 'message', 'Token validado com sucesso. Ocorrência encerrada.');
  ELSE
    -- FALHA: Token Inválido
    UPDATE public.emergency_alerts
    SET termination_token_attempts = termination_token_attempts + 1
    WHERE id = p_alert_id;
    
    RETURN jsonb_build_object('success', false, 'message', 'Token inválido. Tentativa ' || (v_alert.termination_token_attempts + 1) || '/3.');
  END IF;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION validate_termination_token(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

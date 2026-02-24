-- ATUALIZAR TABELA E RPC PARA NOVOS CAMPOS DE VALIDAÇÃO

-- 1. Adicionar colunas detalhadas na tabela emergency_alerts
ALTER TABLE public.emergency_alerts 
ADD COLUMN IF NOT EXISTS validating_police_rank TEXT,
ADD COLUMN IF NOT EXISTS validating_police_name TEXT,
ADD COLUMN IF NOT EXISTS validating_police_matricula TEXT,
ADD COLUMN IF NOT EXISTS validating_police_phone TEXT;

-- 2. Dropar função antiga (assinatura com 4 argumentos)
DROP FUNCTION IF EXISTS validate_termination_token(UUID, TEXT, TEXT, TEXT);

-- 3. Recriar função com 7 argumentos
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
  v_full_officer_id TEXT;
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

  -- Calcular Hash do Input (Upper e Trim para garantir match)
  v_input_hash := encode(digest(upper(trim(p_token_input)) || v_alert.termination_token_salt, 'sha256'), 'hex');

  -- Comparar Hashes
  IF v_input_hash = v_alert.termination_token_hash THEN
    -- SUCESSO: Token Válido
    
    v_full_officer_id := p_rank || ' ' || p_name || ' (' || p_matricula || ')';

    UPDATE public.emergency_alerts
    SET 
      status = 'resolved',
      resolved_at = NOW(),
      validating_police_officer = v_full_officer_id, -- Mantém retrocompatibilidade
      validating_police_rank = p_rank,
      validating_police_name = p_name,
      validating_police_matricula = p_matricula,
      validating_police_phone = p_phone,
      validating_police_battalion = p_battalion,
      notes = COALESCE(notes, '') || E'\n[Validação Policial] Encerrado via Token por: ' || v_full_officer_id || ' - ' || p_battalion || ' - Tel: ' || p_phone
    WHERE id = p_alert_id;

    RETURN jsonb_build_object('success', true, 'message', 'Token validado com sucesso.');
  ELSE
    -- FALHA: Token Inválido
    UPDATE public.emergency_alerts
    SET termination_token_attempts = termination_token_attempts + 1
    WHERE id = p_alert_id;
    
    RETURN jsonb_build_object('success', false, 'message', 'Token inválido. Tentativa ' || (v_alert.termination_token_attempts + 1) || '/3.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_termination_token(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

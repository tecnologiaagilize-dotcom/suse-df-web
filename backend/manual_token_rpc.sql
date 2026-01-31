
-- Função auxiliar para definir o token de encerramento manualmente (baseado no end_token fixo do usuário)
CREATE OR REPLACE FUNCTION set_termination_token_manual(p_alert_id UUID, p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_salt TEXT;
  v_hash TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Validar entrada
  IF p_token IS NULL OR length(p_token) < 4 THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  -- Gerar Salt
  v_salt := encode(gen_random_bytes(16), 'hex');
  
  -- Calcular Hash (SHA256 do Token + Salt)
  v_hash := encode(digest(upper(trim(p_token)) || v_salt, 'sha256'), 'hex');
  
  -- Definir Expiração (60 minutos) - Para o fixo, a expiração é da sessão de encerramento, não do token em si
  v_expires_at := NOW() + INTERVAL '60 minutes';
  
  -- Atualizar Alerta
  UPDATE public.emergency_alerts
  SET 
    termination_token_hash = v_hash,
    termination_token_salt = v_salt,
    termination_token_expires_at = v_expires_at,
    termination_token_attempts = 0,
    status = 'waiting_police_validation',
    termination_requested_at = NOW()
  WHERE id = p_alert_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION set_termination_token_manual(UUID, TEXT) TO authenticated;


-- Atualiza a função de geração automática de token para respeitar o prazo de 45 minutos
CREATE OR REPLACE FUNCTION generate_termination_token(p_alert_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
  v_salt TEXT;
  v_hash TEXT;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verificar se alerta pertence ao usuário (RLS implícito ou check explícito)
  -- Gera Token Aleatório de 8 caracteres (Maiúsculas + Números)
  v_token := upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 8));
  
  -- Gerar Salt
  v_salt := encode(gen_random_bytes(16), 'hex');
  
  -- Calcular Hash (SHA256 do Token + Salt)
  v_hash := encode(digest(v_token || v_salt, 'sha256'), 'hex');
  
  -- Definir Expiração (45 minutos) - Conforme Documento Unificado (token_enc_monit)
  v_expires_at := NOW() + INTERVAL '45 minutes';
  
  -- Atualizar Alerta
  UPDATE public.emergency_alerts
  SET 
    termination_token_hash = v_hash,
    termination_token_salt = v_salt,
    termination_token_expires_at = v_expires_at,
    termination_token_attempts = 0,
    status = 'waiting_police_validation', -- Garante mudança de status
    termination_requested_at = NOW()
  WHERE id = p_alert_id;
  
  -- Retornar o Token em texto claro (ÚNICA VEZ QUE ELE É EXPOSTO)
  RETURN v_token;
END;
$$;

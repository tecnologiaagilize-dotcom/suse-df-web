-- Implementação do Token de Segurança para Encerramento (Conforme Documento Unificado)

-- 1. Habilitar extensão pgcrypto para hashing seguro
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Adicionar colunas de segurança na tabela emergency_alerts
ALTER TABLE public.emergency_alerts 
ADD COLUMN IF NOT EXISTS termination_token_hash TEXT,
ADD COLUMN IF NOT EXISTS termination_token_salt TEXT,
ADD COLUMN IF NOT EXISTS termination_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS termination_token_attempts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS validating_police_officer TEXT;

-- 3. Função RPC para Gerar Token (Chamada pelo Motorista)
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
  -- Gera Token Aleatório de 8 caracteres (Maiúsculas + Números, sem confusão ex: O/0, I/1)
  -- Usamos substring de md5 aleatório e filtramos, ou mapeamento direto.
  -- Simplificação segura: 8 chars hex ou base32 custom
  v_token := upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 8));
  
  -- Gerar Salt
  v_salt := encode(gen_random_bytes(16), 'hex');
  
  -- Calcular Hash (SHA256 do Token + Salt)
  v_hash := encode(digest(v_token || v_salt, 'sha256'), 'hex');
  
  -- Definir Expiração (60 minutos)
  v_expires_at := NOW() + INTERVAL '60 minutes';
  
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

-- 4. Função RPC para Validar Token (Chamada pela Central)
CREATE OR REPLACE FUNCTION validate_termination_token(
  p_alert_id UUID, 
  p_token_input TEXT, 
  p_police_officer TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alert RECORD;
  v_input_hash TEXT;
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

  -- Calcular Hash do Input
  v_input_hash := encode(digest(upper(trim(p_token_input)) || v_alert.termination_token_salt, 'sha256'), 'hex');

  -- Comparar Hashes
  IF v_input_hash = v_alert.termination_token_hash THEN
    -- SUCESSO: Token Válido
    -- Atualiza status para resolvido (mas ainda requer preenchimento do QTO no fluxo de UI, 
    -- porém tecnicamente a validação de segurança passou.
    -- O documento diz: "Status alterado para Encerrada com Validação Policial"
    
    UPDATE public.emergency_alerts
    SET 
      status = 'resolved',
      resolved_at = NOW(),
      validating_police_officer = p_police_officer,
      notes = COALESCE(notes, '') || E'\n[Validação Policial] Encerrado via Token por: ' || p_police_officer
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

-- Permissões
GRANT EXECUTE ON FUNCTION generate_termination_token(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_termination_token(UUID, TEXT, TEXT) TO authenticated;

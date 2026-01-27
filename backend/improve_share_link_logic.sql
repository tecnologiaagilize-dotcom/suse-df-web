-- Melhoria na função de geração de link para evitar duplicidade de agentes
-- e permitir buscar agente existente pelo telefone

CREATE OR REPLACE FUNCTION generate_share_link(
  p_alert_id UUID,
  p_agent_phone TEXT,
  p_agent_name TEXT DEFAULT 'Agente de Campo',
  p_expires_in_hours INT DEFAULT 4
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_agent_id UUID;
  v_token TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  -- Verificar se agente já existe pelo telefone
  SELECT id INTO v_agent_id FROM authorized_agents WHERE phone = p_agent_phone LIMIT 1;

  -- Se não existir, criar novo
  IF v_agent_id IS NULL THEN
      INSERT INTO authorized_agents (name, phone)
      VALUES (p_agent_name, p_agent_phone)
      RETURNING id INTO v_agent_id;
  END IF;
  
  -- Criar Token
  INSERT INTO share_tokens (alert_id, agent_id, created_by, expires_at)
  VALUES (
    p_alert_id, 
    v_agent_id, 
    v_user_id,
    NOW() + (p_expires_in_hours || ' hours')::INTERVAL
  )
  RETURNING token INTO v_token;
  
  -- Auditoria
  INSERT INTO audit_logs (action, actor_id, target_id, metadata)
  VALUES ('GENERATE_LINK', v_user_id, p_alert_id, jsonb_build_object('phone', p_agent_phone, 'agent_id', v_agent_id));
  
  RETURN v_token;
END;
$$;

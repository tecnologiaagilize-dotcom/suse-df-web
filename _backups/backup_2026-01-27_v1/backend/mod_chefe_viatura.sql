-- Atualização: Módulo Chefe de Viatura
-- Adiciona campos detalhados para os agentes e atualiza a função de geração de link

-- 1. Adicionar novas colunas na tabela authorized_agents
ALTER TABLE authorized_agents ADD COLUMN IF NOT EXISTS matricula TEXT;
ALTER TABLE authorized_agents ADD COLUMN IF NOT EXISTS posto_graduacao TEXT;
ALTER TABLE authorized_agents ADD COLUMN IF NOT EXISTS lotacao TEXT;
ALTER TABLE authorized_agents ADD COLUMN IF NOT EXISTS viatura TEXT;
ALTER TABLE authorized_agents ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- 2. Atualizar função generate_share_link para aceitar ID de agente existente
-- Primeiro, removemos a função antiga para recriar com novos parâmetros
DROP FUNCTION IF EXISTS generate_share_link(uuid, text, text, int);

-- Nova versão da função
CREATE OR REPLACE FUNCTION generate_share_link(
  p_alert_id UUID,
  p_agent_id UUID, -- Agora passamos o ID do agente já cadastrado
  p_expires_in_hours INT DEFAULT 4
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token TEXT;
  v_user_id UUID;
  v_agent_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  -- Verificar se o agente existe
  SELECT EXISTS(SELECT 1 FROM authorized_agents WHERE id = p_agent_id) INTO v_agent_exists;
  
  IF NOT v_agent_exists THEN
    RAISE EXCEPTION 'Agente não encontrado';
  END IF;
  
  -- Criar Token
  INSERT INTO share_tokens (alert_id, agent_id, created_by, expires_at)
  VALUES (
    p_alert_id, 
    p_agent_id, 
    v_user_id,
    NOW() + (p_expires_in_hours || ' hours')::INTERVAL
  )
  RETURNING token INTO v_token;
  
  -- Auditoria
  INSERT INTO audit_logs (action, actor_id, target_id, metadata)
  VALUES ('GENERATE_LINK', v_user_id, p_alert_id, jsonb_build_object('agent_id', p_agent_id));
  
  RETURN v_token;
END;
$$;

-- 3. Garantir permissões na nova função
GRANT EXECUTE ON FUNCTION generate_share_link(UUID, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_share_link(UUID, UUID, INT) TO service_role;

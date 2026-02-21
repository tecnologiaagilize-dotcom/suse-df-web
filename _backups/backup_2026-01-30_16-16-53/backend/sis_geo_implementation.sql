-- Implementação do Módulo SIS_GEO (Monitoramento e Compartilhamento Seguro)
-- Execute este script no SQL Editor do Supabase

-- 1. Tabela de Agentes Autorizados (Quem recebe o link)
CREATE TABLE IF NOT EXISTS authorized_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, -- Pode ser opcional se enviarmos direto pro numero
  phone TEXT NOT NULL,
  organization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Tokens de Compartilhamento (Links Seguros)
CREATE TABLE IF NOT EXISTS share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  alert_id UUID REFERENCES emergency_alerts(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES authorized_agents(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- 3. Tabela de Logs de Auditoria (Rastreabilidade)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL, -- 'GENERATE_LINK', 'ACCESS_LINK', 'CLOSE_ALERT'
  actor_id UUID, -- ID do usuário ou NULL se for acesso público anônimo
  target_id UUID, -- ID do Alerta ou Token
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_id);

-- Habilitar RLS
ALTER TABLE authorized_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (RLS) - Apenas Staff gerencia
CREATE POLICY "Staff manage agents" ON authorized_agents FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));
CREATE POLICY "Staff manage tokens" ON share_tokens FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));
CREATE POLICY "Staff read audit" ON audit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));
CREATE POLICY "Staff insert audit" ON audit_logs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));

-- FUNÇÃO 1: Gerar Link de Compartilhamento (RPC)
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
  
  -- Registrar Agente (se novo)
  INSERT INTO authorized_agents (name, phone)
  VALUES (p_agent_name, p_agent_phone)
  RETURNING id INTO v_agent_id;
  
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
  VALUES ('GENERATE_LINK', v_user_id, p_alert_id, jsonb_build_object('phone', p_agent_phone));
  
  RETURN v_token;
END;
$$;

-- FUNÇÃO 2: Acesso Público Seguro (Via Token)
CREATE OR REPLACE FUNCTION get_shared_alert_data(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token_record share_tokens%ROWTYPE;
  v_alert emergency_alerts%ROWTYPE;
  v_user users%ROWTYPE;
  v_last_location location_updates%ROWTYPE;
BEGIN
  -- Validar Token
  SELECT * INTO v_token_record
  FROM share_tokens
  WHERE token = p_token 
    AND is_active = TRUE 
    AND expires_at > NOW();
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Token inválido ou expirado');
  END IF;
  
  -- Buscar Dados (Somente Leitura)
  SELECT * INTO v_alert FROM emergency_alerts WHERE id = v_token_record.alert_id;
  SELECT * INTO v_user FROM users WHERE id = v_alert.user_id;
  
  -- Última Localização
  SELECT * INTO v_last_location 
  FROM location_updates 
  WHERE alert_id = v_alert.id 
  ORDER BY recorded_at DESC 
  LIMIT 1;
  
  -- Auditoria de Acesso
  INSERT INTO audit_logs (action, target_id, metadata)
  VALUES ('ACCESS_LINK', v_token_record.id, jsonb_build_object('token', p_token));
  
  -- Retorno Higienizado (LGPD - Apenas dados necessários)
  RETURN jsonb_build_object(
    'valid', true,
    'alert_id', v_alert.id,
    'status', v_alert.status,
    'driver_name', v_user.name,
    'car_brand', v_user.car_brand,
    'car_model', v_user.car_model,
    'car_plate', v_user.car_plate,
    'car_color', v_user.car_color,
    'initial_lat', v_alert.initial_lat,
    'initial_lng', v_alert.initial_lng,
    'current_lat', COALESCE(v_last_location.latitude, v_alert.initial_lat),
    'current_lng', COALESCE(v_last_location.longitude, v_alert.initial_lng),
    'last_update', COALESCE(v_last_location.recorded_at, v_alert.created_at)
  );
END;
$$;

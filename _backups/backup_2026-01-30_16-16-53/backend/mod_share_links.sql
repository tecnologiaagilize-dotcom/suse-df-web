-- Tabela para armazenar links de compartilhamento seguros
CREATE TABLE IF NOT EXISTS share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES emergency_alerts(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    share_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Política: Staff pode criar e ver links
CREATE POLICY "Staff manage share links" 
ON share_links FOR ALL 
TO authenticated 
USING (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));

-- Política: Leitura pública via RPC (não direta na tabela)
-- A função RPC usará SECURITY DEFINER para bypassar RLS na leitura pública

-- Função para criar link de compartilhamento
CREATE OR REPLACE FUNCTION create_share_link(
  p_alert_id UUID,
  p_expires_in_minutes INT DEFAULT 60
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Verificar se quem chama é staff ou dono (aqui simplificado para staff via RLS check implícito na app)
  
  -- Gerar token único seguro
  LOOP
    v_token := encode(gen_random_bytes(16), 'hex');
    SELECT EXISTS(SELECT 1 FROM share_links WHERE share_token = v_token) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;

  INSERT INTO share_links (alert_id, created_by, share_token, expires_at)
  VALUES (
    p_alert_id,
    auth.uid(),
    v_token,
    NOW() + (p_expires_in_minutes || ' minutes')::INTERVAL
  );

  RETURN v_token;
END;
$$;

-- Função Pública para Ler Dados do Link
CREATE OR REPLACE FUNCTION get_shared_alert_data(p_token TEXT)
RETURNS TABLE (
  alert_id UUID,
  status VARCHAR,
  lat DECIMAL,
  lng DECIMAL,
  last_update TIMESTAMPTZ,
  driver_name VARCHAR,
  car_model VARCHAR,
  car_plate VARCHAR,
  car_color VARCHAR,
  driver_phone VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_alert_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT alert_id, expires_at INTO v_alert_id, v_expires_at
  FROM share_links
  WHERE share_token = p_token AND is_active = true;

  IF v_alert_id IS NULL OR v_expires_at < NOW() THEN
    RETURN; -- Retorna vazio se inválido
  END IF;

  RETURN QUERY
  SELECT 
    ea.id,
    ea.status,
    COALESCE(lu.latitude, ea.initial_lat) as lat,
    COALESCE(lu.longitude, ea.initial_lng) as lng,
    COALESCE(lu.recorded_at, ea.created_at) as last_update,
    u.name,
    u.car_model,
    u.car_plate,
    'Não informado'::VARCHAR as car_color, -- Adicionar coluna cor na tabela users depois se precisar
    u.phone_number
  FROM emergency_alerts ea
  JOIN users u ON u.id = ea.user_id
  LEFT JOIN location_updates lu ON lu.id = (
      SELECT id FROM location_updates WHERE alert_id = ea.id ORDER BY recorded_at DESC LIMIT 1
  )
  WHERE ea.id = v_alert_id;
END;
$$;

-- Função RPC para SharedAlert.jsx
-- Resolve erro no link de rastreamento (acesso anônimo)

CREATE OR REPLACE FUNCTION get_shared_alert_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Roda como admin
AS $$
DECLARE
  v_alert_id uuid;
  v_result jsonb;
BEGIN
  -- 1. Validar Token na tabela share_links
  SELECT alert_id INTO v_alert_id
  FROM share_links
  WHERE share_token = p_token
  AND expires_at > NOW()
  AND is_active = true;

  IF v_alert_id IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  -- 2. Buscar Dados do Alerta + Motorista + Última Localização
  SELECT jsonb_build_object(
    'valid', true,
    'alert_id', a.id,
    'status', a.status,
    'current_lat', COALESCE((SELECT latitude FROM location_updates WHERE alert_id = a.id ORDER BY recorded_at DESC LIMIT 1), a.initial_lat),
    'current_lng', COALESCE((SELECT longitude FROM location_updates WHERE alert_id = a.id ORDER BY recorded_at DESC LIMIT 1), a.initial_lng),
    'last_update', COALESCE((SELECT recorded_at FROM location_updates WHERE alert_id = a.id ORDER BY recorded_at DESC LIMIT 1), a.created_at),
    'driver_name', u.name,
    'car_brand', u.car_brand,
    'car_model', u.car_model,
    'car_plate', u.car_plate,
    'car_color', u.car_color
  ) INTO v_result
  FROM emergency_alerts a
  JOIN users u ON a.user_id = u.id
  WHERE a.id = v_alert_id;

  RETURN v_result;
END;
$$;

-- Liberar acesso para usuários anônimos (quem clica no link)
GRANT EXECUTE ON FUNCTION get_shared_alert_data(text) TO anon;
GRANT EXECUTE ON FUNCTION get_shared_alert_data(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_alert_data(text) TO service_role;

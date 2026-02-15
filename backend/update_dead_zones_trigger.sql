-- Adicionar coluna de status de conectividade
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS connectivity_status TEXT DEFAULT 'ONLINE'; -- 'ONLINE', 'OFFLINE', 'DEAD_ZONE'

-- Atualizar Trigger para refletir mudança de status no Alerta Principal
CREATE OR REPLACE FUNCTION check_dead_zone_entry()
RETURNS TRIGGER AS $$
DECLARE
    v_zone_name TEXT;
    v_expected_time INT;
BEGIN
    -- Verifica se o ponto atual está DENTRO de alguma zona de sombra
    SELECT name, expected_transit_time_min
    INTO v_zone_name, v_expected_time
    FROM dead_zones
    WHERE ST_Intersects(NEW.geom, boundary)
    LIMIT 1;

    -- Se estiver em uma zona de sombra
    IF v_zone_name IS NOT NULL THEN
        -- Registrar aviso (Log)
        INSERT INTO audit_logs (action, target_id, metadata)
        VALUES (
            'ENTERED_DEAD_ZONE', 
            NEW.alert_id, 
            jsonb_build_object(
                'zone', v_zone_name, 
                'lat', NEW.latitude, 
                'lng', NEW.longitude,
                'expected_return_min', v_expected_time
            )
        );

        -- ATUALIZAR STATUS DO ALERTA (Isso dispara o realtime no Frontend)
        UPDATE emergency_alerts 
        SET connectivity_status = 'DEAD_ZONE',
            notes = COALESCE(notes, '') || E'\n[SISTEMA] Entrou em Zona de Sombra: ' || v_zone_name
        WHERE id = NEW.alert_id AND connectivity_status != 'DEAD_ZONE';
        
    ELSE
        -- Se NÃO estiver em zona de sombra, mas estava antes, voltar para ONLINE
        -- (Isso assume que recebemos um ponto fora... se o sinal caiu, não recebemos nada, 
        -- mas quando voltar, atualiza para ONLINE)
        UPDATE emergency_alerts 
        SET connectivity_status = 'ONLINE'
        WHERE id = NEW.alert_id AND connectivity_status = 'DEAD_ZONE';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

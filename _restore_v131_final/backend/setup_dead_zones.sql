-- Tabela de Zonas de Sombra (Dead Zones)
CREATE TABLE IF NOT EXISTS dead_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- Ex: "Túnel do Eixão", "BR-020 Km 40"
    description TEXT,
    boundary GEOGRAPHY(POLYGON, 4326), -- A área sem sinal
    expected_transit_time_min INT DEFAULT 5, -- Tempo esperado para atravessar/retornar
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir Dados de Exemplo (Zonas Conhecidas no DF)
INSERT INTO dead_zones (name, description, boundary, expected_transit_time_min) VALUES 
(
    'Buraco do Tatu (Eixão)',
    'Túnel de ligação Eixão Norte-Sul. Perda total de sinal.',
    ST_GeographyFromText('POLYGON((-47.882 -15.794, -47.881 -15.794, -47.881 -15.796, -47.882 -15.796, -47.882 -15.794))'),
    2
),
(
    'Subida do Colorado (Topo)',
    'Área de sombra intermitente entre torres.',
    ST_GeographyFromText('POLYGON((-47.850 -15.680, -47.840 -15.680, -47.840 -15.690, -47.850 -15.690, -47.850 -15.680))'),
    5
);

-- Trigger para detectar entrada em Zona de Sombra
-- A ideia é registrar um evento na tabela audit_logs ou atualizar o status do alerta
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
        -- Registrar aviso
        RAISE NOTICE 'ALERTA: Motorista entrou na Zona de Sombra: %', v_zone_name;
        
        -- Atualizar o alerta com a informação de sombra (usando um campo JSONB ou notes)
        -- Aqui vamos adicionar um log na tabela audit_logs (criada anteriormente)
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

        -- Opcional: Atualizar status do alerta se for crítico
        -- UPDATE emergency_alerts SET connectivity_status = 'OFFLINE_EXPECTED' WHERE id = NEW.alert_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ativar Trigger
DROP TRIGGER IF EXISTS trg_check_dead_zone ON location_updates;
CREATE TRIGGER trg_check_dead_zone
AFTER INSERT ON location_updates
FOR EACH ROW
EXECUTE FUNCTION check_dead_zone_entry();

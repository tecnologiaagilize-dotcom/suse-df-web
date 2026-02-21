-- Tabela de Regiões Administrativas (Cerca Virtual)
CREATE TABLE IF NOT EXISTS administrative_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- Ex: "Plano Piloto", "Taguatinga"
    boundary GEOGRAPHY(MULTIPOLYGON, 4326), -- O perímetro real
    risk_level TEXT DEFAULT 'LOW', -- LOW, MEDIUM, HIGH
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Preferências do Motorista (Onde ele quer atuar)
CREATE TABLE IF NOT EXISTS driver_geofence_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    region_id UUID REFERENCES administrative_regions(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, region_id)
);

-- Inserir dados de exemplo (Plano Piloto e Taguatinga - Polígonos Simplificados para Teste)
-- Nota: Em produção, usaríamos ST_GeomFromGeoJSON com dados reais do IBGE/GDF
INSERT INTO administrative_regions (name, boundary, risk_level)
VALUES 
(
    'Plano Piloto',
    ST_GeographyFromText('MULTIPOLYGON(((-47.95 -15.75, -47.85 -15.75, -47.85 -15.85, -47.95 -15.85, -47.95 -15.75)))'),
    'LOW'
),
(
    'Ceilândia',
    ST_GeographyFromText('MULTIPOLYGON(((-48.15 -15.75, -48.05 -15.75, -48.05 -15.85, -48.15 -15.85, -48.15 -15.75)))'),
    'MEDIUM'
)
ON CONFLICT (name) DO NOTHING;

-- Função Trigger: Verificar se o motorista está fora da sua área permitida
CREATE OR REPLACE FUNCTION check_geofence_violation()
RETURNS TRIGGER AS $$
DECLARE
    v_is_allowed BOOLEAN;
    v_has_preferences BOOLEAN;
BEGIN
    -- 1. Verificar se o motorista tem alguma preferência configurada
    SELECT EXISTS (
        SELECT 1 FROM driver_geofence_preferences 
        WHERE user_id = (SELECT user_id FROM emergency_alerts WHERE id = NEW.alert_id)
        AND is_active = TRUE
    ) INTO v_has_preferences;

    -- Se não tiver preferências, assume que pode rodar em qualquer lugar (ou bloqueia tudo, dependendo da regra)
    -- Aqui: Se não escolheu nada, está LIVRE.
    IF NOT v_has_preferences THEN
        RETURN NEW;
    END IF;

    -- 2. Verificar se o ponto atual está DENTRO de alguma das regiões permitidas
    SELECT EXISTS (
        SELECT 1 
        FROM driver_geofence_preferences dp
        JOIN administrative_regions ar ON dp.region_id = ar.id
        WHERE dp.user_id = (SELECT user_id FROM emergency_alerts WHERE id = NEW.alert_id)
        AND dp.is_active = TRUE
        AND ST_Intersects(NEW.geom, ar.boundary)
    ) INTO v_is_allowed;

    -- 3. Se estiver FORA (v_is_allowed = FALSE), registrar violação
    IF NOT v_is_allowed THEN
        -- Logar ou notificar
        RAISE NOTICE 'ALERTA DE CERCA VIRTUAL: Motorista saiu da área permitida!';
        
        -- Opcional: Marcar o alerta como 'WATCHLIST' ou similar
        -- UPDATE emergency_alerts SET status = 'WATCHLIST' WHERE id = NEW.alert_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ativar trigger
DROP TRIGGER IF EXISTS trg_check_geofence ON location_updates;
CREATE TRIGGER trg_check_geofence
AFTER INSERT ON location_updates
FOR EACH ROW
EXECUTE FUNCTION check_geofence_violation();

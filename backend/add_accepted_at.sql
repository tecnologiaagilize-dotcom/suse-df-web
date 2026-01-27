-- Adicionar coluna para registrar quando o chamado foi aceito
ALTER TABLE emergency_alerts 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Adicionar colunas extras no usuário se faltarem (para garantir que temos a foto e dados)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS car_model TEXT,
ADD COLUMN IF NOT EXISTS car_plate TEXT;

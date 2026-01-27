-- Módulo: Dados Motorista no Mapa (mod_dados_motmapa)
-- Objetivo: Garantir colunas de veículo na tabela users para exibição no dashboard

-- Adicionar colunas de veículo se não existirem
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_brand VARCHAR(50); -- Marca
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_model VARCHAR(100); -- Modelo
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_plate VARCHAR(20);  -- Placa
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_color VARCHAR(50);  -- Cor

-- Atualizar permissões de leitura (caso RLS esteja ativo e restritivo)
-- (Opcional, mas recomendado para garantir que o dashboard leia esses dados)
-- Assumindo que a policy "Staff can view all alerts" já cobre o join com users, 
-- mas se users tiver RLS próprio, precisamos garantir acesso.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Staff can read all users'
    ) THEN
        CREATE POLICY "Staff can read all users" ON users
        FOR SELECT
        TO authenticated
        USING (EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()));
    END IF;
END
$$;

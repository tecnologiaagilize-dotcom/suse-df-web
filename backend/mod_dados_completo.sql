-- Módulo: Dados Completos (Motorista, Veículo, Contatos)
-- Objetivo: Suportar ficha completa do motorista e visualização no dashboard

-- 1. Garantir colunas do Motorista
ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cnh VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}'::jsonb; -- Endereço do motorista

-- 2. Garantir colunas de Veículo (já adicionadas, mas reforçando)
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_brand VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_model VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_plate VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_color VARCHAR(50);

-- 3. Nova coluna para Contatos de Emergência (Lista de objetos)
-- Estrutura esperada: [{ name, relationship, phone, address }]
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contacts JSONB DEFAULT '[]'::jsonb;

-- 4. Atualizar Policy para permitir que Staff leia tudo
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

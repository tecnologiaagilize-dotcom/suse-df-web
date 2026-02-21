-- Script de Reparo de Estrutura (Garantir colunas na tabela USERS)
-- Execute no SQL Editor do Supabase

-- Adicionar colunas se não existirem
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS matricula VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_model VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_plate VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_color VARCHAR(50);

-- Garantir que emergency_alerts tenha accepted_at
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- Recriar Permissões de Leitura para Staff (Garantia)
DROP POLICY IF EXISTS "Staff can view all alerts" ON emergency_alerts;
CREATE POLICY "Staff can view all alerts" 
ON emergency_alerts FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

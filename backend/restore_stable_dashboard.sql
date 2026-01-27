-- Script para Restaurar Estabilidade do Dashboard (Sem WhatsApp/Carro)
-- Execute no SQL Editor do Supabase

-- 1. Garantir colunas essenciais para o Dashboard (Foto e Matrícula)
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS matricula VARCHAR(50);

-- 2. Garantir coluna para o Timer de Espera
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 3. Garantir permissões de leitura (caso tenham sido perdidas)
DROP POLICY IF EXISTS "Staff can view all alerts" ON emergency_alerts;
CREATE POLICY "Staff can view all alerts" 
ON emergency_alerts FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()) OR 
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()) -- Permitir que users vejam seus próprios (ou ajuste conforme necessidade)
);

-- NOTA: Não estamos adicionando colunas de carro (car_model, etc) pois foram removidas do frontend.

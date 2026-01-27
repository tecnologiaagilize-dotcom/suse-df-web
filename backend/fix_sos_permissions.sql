-- Script de Liberação Total para SOS e Rastreamento
-- Execute no SQL Editor do Supabase para corrigir o erro "Botão não envia"

-- 1. Tabela EMERGENCY_ALERTS
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Users can create alerts" ON emergency_alerts;
DROP POLICY IF EXISTS "Users can view own alerts" ON emergency_alerts;
DROP POLICY IF EXISTS "Staff can view all alerts" ON emergency_alerts;
DROP POLICY IF EXISTS "Staff can update alerts" ON emergency_alerts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON emergency_alerts;
DROP POLICY IF EXISTS "Enable read for users based on user_id" ON emergency_alerts;

-- Criar Políticas Simplificadas e Robustas

-- INSERT: Qualquer usuário autenticado pode criar um alerta para si mesmo
CREATE POLICY "Allow users to create alerts" 
ON emergency_alerts FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- SELECT: Usuário vê os seus, Staff vê todos
CREATE POLICY "Allow users to view own alerts" 
ON emergency_alerts FOR SELECT 
TO authenticated 
USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

-- UPDATE: Staff pode assumir/finalizar (status), Usuário pode (opcionalmente) cancelar
CREATE POLICY "Allow staff to update alerts" 
ON emergency_alerts FOR UPDATE 
TO authenticated 
USING (
    EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()) OR
    auth.uid() = user_id
);


-- 2. Tabela LOCATION_UPDATES
ALTER TABLE location_updates ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can insert location updates" ON location_updates;
DROP POLICY IF EXISTS "Staff can view all locations" ON location_updates;

-- INSERT: Permitir que o dono do alerta insira localização
CREATE POLICY "Allow users to insert location" 
ON location_updates FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM emergency_alerts 
        WHERE id = alert_id 
        AND user_id = auth.uid()
    )
);

-- SELECT: Staff vê tudo, Usuário vê o seu
CREATE POLICY "Allow staff to view locations" 
ON location_updates FOR SELECT 
TO authenticated 
USING (
    EXISTS (SELECT 1 FROM staff WHERE id = auth.uid()) OR
    EXISTS (
        SELECT 1 FROM emergency_alerts 
        WHERE id = alert_id 
        AND user_id = auth.uid()
    )
);

-- 3. Grant final para garantir
GRANT ALL ON emergency_alerts TO authenticated;
GRANT ALL ON location_updates TO authenticated;

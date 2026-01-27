-- Script de Correção Definitiva de Permissões para ALERTAS e LOCALIZAÇÃO
-- Execute no SQL Editor do Supabase

-- 1. Tabela EMERGENCY_ALERTS
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can create alerts" ON emergency_alerts;
DROP POLICY IF EXISTS "Users can view own alerts" ON emergency_alerts;
DROP POLICY IF EXISTS "Staff can view all alerts" ON emergency_alerts;
DROP POLICY IF EXISTS "Staff can update alerts" ON emergency_alerts;

-- Criar Políticas Limpas
-- Permitir INSERT para autenticados (verificando user_id)
CREATE POLICY "Users can create alerts" 
ON emergency_alerts FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Permitir SELECT para o dono do alerta
CREATE POLICY "Users can view own alerts" 
ON emergency_alerts FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Permitir STAFF ver tudo (Simplificado: se for autenticado e existir na tabela staff)
-- Nota: Para testes rápidos, podemos permitir que qualquer autenticado leia, mas vamos manter a segurança mínima
CREATE POLICY "Staff can view all alerts" 
ON emergency_alerts FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

-- Permitir STAFF editar (para assumir ocorrência)
CREATE POLICY "Staff can update alerts" 
ON emergency_alerts FOR UPDATE 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);


-- 2. Tabela LOCATION_UPDATES
ALTER TABLE location_updates ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Users can insert location updates" ON location_updates;
DROP POLICY IF EXISTS "Staff can view all locations" ON location_updates;

-- Criar Políticas Limpas
-- Permitir INSERT de localização se o alerta pertencer ao usuário
CREATE POLICY "Users can insert location updates" 
ON location_updates FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM emergency_alerts 
    WHERE id = alert_id 
    AND user_id = auth.uid()
  )
);

-- Permitir STAFF ver localizações
CREATE POLICY "Staff can view all locations" 
ON location_updates FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

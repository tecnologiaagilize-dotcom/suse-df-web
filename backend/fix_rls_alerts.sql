-- Script para corrigir Permissões (RLS) nas tabelas de Alerta
-- Resolve o erro "row-level security policy" ao enviar SOS

-- Habilitar RLS
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;

-- 1. Permitir criar alerta (INSERT)
DROP POLICY IF EXISTS "Users can create own alerts" ON public.emergency_alerts;
CREATE POLICY "Users can create own alerts" 
ON public.emergency_alerts FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 2. Permitir ver seus próprios alertas (SELECT)
DROP POLICY IF EXISTS "Users can view own alerts" ON public.emergency_alerts;
CREATE POLICY "Users can view own alerts" 
ON public.emergency_alerts FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 3. Permitir criar atualização de localização (INSERT)
DROP POLICY IF EXISTS "Users can add location updates" ON public.location_updates;
CREATE POLICY "Users can add location updates" 
ON public.location_updates FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.emergency_alerts 
    WHERE id = alert_id AND user_id = auth.uid()
  )
);

-- 4. Permitir Staff ver tudo (para o painel de monitoramento)
DROP POLICY IF EXISTS "Staff can view all alerts" ON public.emergency_alerts;
CREATE POLICY "Staff can view all alerts" 
ON public.emergency_alerts FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.staff WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Staff can view all locations" ON public.location_updates;
CREATE POLICY "Staff can view all locations" 
ON public.location_updates FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM public.staff WHERE id = auth.uid())
);

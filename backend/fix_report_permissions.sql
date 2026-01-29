-- Garantir permissões para finalização de ocorrência e criação de relatórios
-- Resolve erro onde ocorrência não sai da fila (falha no insert do relatório)

-- 1. Incident Reports (Relatórios Finais)
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage reports" ON public.incident_reports;
CREATE POLICY "Staff can manage reports"
ON public.incident_reports
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. Report Attachments (Anexos)
ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage attachments" ON public.report_attachments;
CREATE POLICY "Staff can manage attachments"
ON public.report_attachments
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Emergency Alerts (Permitir update de status para resolved)
-- Nota: Isso é crítico. Se o staff não puder dar update, o status não muda.
DROP POLICY IF EXISTS "Staff can update alerts" ON public.emergency_alerts;
CREATE POLICY "Staff can update alerts"
ON public.emergency_alerts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

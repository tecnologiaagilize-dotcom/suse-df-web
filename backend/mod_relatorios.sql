-- Tabela para armazenar Relatórios de Atendimento
CREATE TABLE IF NOT EXISTS incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES emergency_alerts(id) UNIQUE, -- Um relatório por alerta
  qto_number VARCHAR(50), -- Número da QTO
  description TEXT, -- Descrição detalhada do atendimento
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID -- ID do staff que criou
);

-- Tabela para Anexos (Fotos, Documentos) do Relatório
CREATE TABLE IF NOT EXISTS report_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES incident_reports(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50), -- 'image', 'document', etc
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Seguro rodar múltiplas vezes)
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (Com verificação se já existem)
DROP POLICY IF EXISTS "Staff manage reports" ON incident_reports;
CREATE POLICY "Staff manage reports" ON incident_reports FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Staff manage attachments" ON report_attachments;
CREATE POLICY "Staff manage attachments" ON report_attachments FOR ALL TO authenticated USING (true);

-- Buckets de Storage (comando ilustrativo, executar no painel se necessário)
-- insert into storage.buckets (id, name) values ('report-files', 'report-files');

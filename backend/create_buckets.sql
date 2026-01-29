-- Criar buckets de Storage necessários
-- Resolve erro "Bucket not found"

-- 1. Bucket para Evidências de Encerramento (Foto do Motorista)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('termination-evidence', 'termination-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para termination-evidence
-- Remover políticas antigas para evitar conflito
DROP POLICY IF EXISTS "Authenticated users can upload evidence" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view evidence" ON storage.objects;

-- Criar novas políticas
CREATE POLICY "Authenticated users can upload evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'termination-evidence' );

CREATE POLICY "Anyone can view evidence"
ON storage.objects FOR SELECT
TO authenticated, anon
USING ( bucket_id = 'termination-evidence' );


-- 2. Bucket para Anexos do Relatório Final (Central)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('report-files', 'report-files', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para report-files
DROP POLICY IF EXISTS "Staff can upload reports" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view reports" ON storage.objects;

CREATE POLICY "Staff can upload reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'report-files' );

CREATE POLICY "Staff can view reports"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'report-files' );

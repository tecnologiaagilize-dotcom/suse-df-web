-- Criar buckets de Storage necessários e configurar permissões públicas
-- Resolve erro "Bucket not found" e problemas de acesso (403 Forbidden)

-- 1. Bucket para Evidências de Encerramento (Foto do Motorista)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('termination-evidence', 'termination-evidence', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas para termination-evidence
-- Remover políticas antigas para evitar conflito e garantir limpeza
DROP POLICY IF EXISTS "Authenticated users can upload evidence" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view evidence" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update evidence" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete evidence" ON storage.objects;

-- INSERT: Apenas autenticados (Motoristas)
CREATE POLICY "Authenticated users can upload evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'termination-evidence' );

-- SELECT: Público (Qualquer um com o link pode ver - anon + authenticated)
CREATE POLICY "Anyone can view evidence"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'termination-evidence' );

-- UPDATE: Autenticados (Permite corrigir envio)
CREATE POLICY "Authenticated users can update evidence"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'termination-evidence' );

-- DELETE: Autenticados (Permite remover envio incorreto)
CREATE POLICY "Authenticated users can delete evidence"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'termination-evidence' );


-- 2. Bucket para Anexos do Relatório Final (Central)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('report-files', 'report-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas para report-files
DROP POLICY IF EXISTS "Staff can upload reports" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view reports" ON storage.objects;
DROP POLICY IF EXISTS "Public view reports" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update reports" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete reports" ON storage.objects;

-- INSERT: Autenticados (Staff/Admin)
CREATE POLICY "Staff can upload reports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'report-files' );

-- SELECT: Público (Para permitir visualização em links compartilhados sem login)
CREATE POLICY "Public view reports"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'report-files' );

-- UPDATE: Autenticados
CREATE POLICY "Staff can update reports"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'report-files' );

-- DELETE: Autenticados
CREATE POLICY "Staff can delete reports"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'report-files' );

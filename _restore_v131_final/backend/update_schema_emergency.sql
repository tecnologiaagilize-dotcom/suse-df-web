-- Atualizações para o módulo de Emergência e Perfil

-- 1. Tabela users: Ajustar coluna de contatos de emergência e endereço
-- Renomeia se existir com erro de digitação (emergency_contats -> emergency_contacts)
DO $$
BEGIN
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'emergency_contats') THEN
      ALTER TABLE users RENAME COLUMN emergency_contats TO emergency_contacts;
  END IF;
END $$;

-- Garante que a coluna existe e é do tipo JSONB
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contacts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}'::jsonb;

-- Garante outras colunas do perfil
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_brand TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_model TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_plate TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS car_color TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cnh TEXT;

-- 2. Tabela emergency_alerts: Colunas para encerramento verificado
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS termination_photo_url TEXT;
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS termination_reason TEXT;

-- 3. Bucket para evidências de encerramento (termination-evidence)
INSERT INTO storage.buckets (id, name, public)
VALUES ('termination-evidence', 'termination-evidence', true) -- Public true para facilitar visualização pela polícia/admin
ON CONFLICT (id) DO NOTHING;

-- Políticas para termination-evidence
-- Permitir upload de qualquer usuário autenticado (para enviar a foto de encerramento)
CREATE POLICY "Users can upload termination evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'termination-evidence' );

-- Permitir visualização (pode ser restrito a admin/staff depois, mas deixamos auth por enquanto)
CREATE POLICY "Authenticated users can view termination evidence"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'termination-evidence' );


-- Garantir que o bucket 'avatars' exista e seja público
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de acesso ao bucket 'avatars'
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can upload an avatar"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'avatars' );

CREATE POLICY "Anyone can update their own avatar"
ON storage.objects FOR UPDATE
USING ( auth.uid() = owner )
WITH CHECK ( bucket_id = 'avatars' );

-- Garantir que a tabela legal_documents tenha pelo menos um registro ativo
INSERT INTO legal_documents (version, document_hash, content_snapshot, is_active)
VALUES (
  '1.0',
  'sha256-placeholder-hash-v1.0', 
  E'# TERMO DE USO E POLÍTICA DE PRIVACIDADE (LGPD) - SUSE v1.0\n\n' ||
  E'## 1. OBJETIVO\n' ||
  E'Este documento estabelece as regras de uso do Sistema Unificado de Suporte e Emergência (SUSE), em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).\n\n' ||
  E'## 2. NATUREZA DO SERVIÇO\n' ||
  E'O SUSE é uma ferramenta tecnológica auxiliar privada. NÃO substitui os canais oficiais (190, 193).\n\n' ||
  E'## 3. DECLARAÇÃO DE CIÊNCIA\n' ||
  E'Declaro que li, compreendi e aceito integralmente os termos.',
  true
) ON CONFLICT (version) DO NOTHING;

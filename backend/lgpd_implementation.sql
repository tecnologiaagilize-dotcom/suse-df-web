-- Módulo 11: LGPD + Termo de Ciência Obrigatório

-- 8.1 Tabela: legal_documents
CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  document_hash TEXT NOT NULL,
  content_snapshot TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8.2 Tabela: user_legal_acceptance
CREATE TABLE IF NOT EXISTS user_legal_acceptance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  document_version TEXT NOT NULL REFERENCES legal_documents(version),
  document_hash TEXT NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  device_id TEXT,
  revoked BOOLEAN DEFAULT false,
  UNIQUE(user_id, document_version)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_legal_acceptance_user_id ON user_legal_acceptance(user_id);
CREATE INDEX IF NOT EXISTS idx_user_legal_acceptance_version ON user_legal_acceptance(document_version);

-- RLS Policies
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_legal_acceptance ENABLE ROW LEVEL SECURITY;

-- Public read access to active legal documents
CREATE POLICY "Public read active legal documents" ON legal_documents
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Users can insert their own acceptance
CREATE POLICY "Users can insert own acceptance" ON user_legal_acceptance
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own acceptance
CREATE POLICY "Users can view own acceptance" ON user_legal_acceptance
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Seed Initial Document (Version 1.0)
INSERT INTO legal_documents (version, document_hash, content_snapshot)
VALUES (
  '1.0',
  'sha256-placeholder-hash-v1.0', 
  E'# TERMO DE USO E POLÍTICA DE PRIVACIDADE (LGPD) - SUSE v1.0\n\n' ||
  E'## 1. OBJETIVO\n' ||
  E'Este documento estabelece as regras de uso do Sistema Unificado de Suporte e Emergência (SUSE), em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), Marco Civil da Internet e Código Civil Brasileiro.\n\n' ||
  E'## 2. NATUREZA DO SERVIÇO\n' ||
  E'O SUSE é uma ferramenta tecnológica auxiliar privada, gratuita, de envio de mensagens de emergência. NÃO substitui os canais oficiais (190, 193, 197). Não há garantia de resultado ou atendimento estatal.\n\n' ||
  E'## 3. COLETA E TRATAMENTO DE DADOS\n' ||
  E'Coletamos dados de geolocalização em tempo real, áudio ambiente (apenas durante emergências acionadas) e metadados do dispositivo para garantir a segurança do usuário e a prova jurídica da ocorrência.\n\n' ||
  E'## 4. COMPARTILHAMENTO\n' ||
  E'Seus dados podem ser compartilhados com autoridades de segurança pública e serviços de emergência em caso de acionamento do botão de pânico ou detecção de risco.\n\n' ||
  E'## 5. DIREITOS E REVOGAÇÃO\n' ||
  E'O usuário pode revogar este consentimento a qualquer momento, o que implicará na suspensão imediata das funcionalidades de monitoramento.\n\n' ||
  E'## 6. DECLARAÇÃO DE CIÊNCIA\n' ||
  E'Declaro que li, compreendi e aceito integralmente os termos acima.'
) ON CONFLICT (version) DO NOTHING;

-- RPC function to check if user accepted the latest version
CREATE OR REPLACE FUNCTION check_user_accepted_latest_terms(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  latest_version TEXT;
  has_accepted BOOLEAN;
BEGIN
  -- Get latest active version
  SELECT version INTO latest_version
  FROM legal_documents
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF latest_version IS NULL THEN
    RETURN TRUE; -- No terms to accept
  END IF;

  -- Check if user accepted this version
  SELECT EXISTS (
    SELECT 1
    FROM user_legal_acceptance
    WHERE user_id = p_user_id
      AND document_version = latest_version
      AND revoked = false
  ) INTO has_accepted;

  RETURN has_accepted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

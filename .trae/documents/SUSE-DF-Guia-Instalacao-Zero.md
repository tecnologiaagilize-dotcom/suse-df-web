# SUSE-DF - Guia de Instalação do Zero

## 📋 Visão Geral

Este guia fornece instruções completas para instalar e configurar o Sistema Unificado de Segurança e Emergência (SUSE-DF) desde o zero, incluindo todos os scripts SQL, configurações de ambiente e deploy dos serviços.

## 🚀 Pré-requisitos

### Contas Necessárias
- [ ] Conta no Supabase (https://supabase.com)
- [ ] Conta no GitHub (https://github.com)
- [ ] Conta no Vercel (https://vercel.com)
- [ ] Conta no Railway (https://railway.app) - para o serviço Python

### Ferramentas Locais
- [ ] Node.js >= 20.0.0
- [ ] Git
- [ ] Editor de código (VS Code recomendado)
- [ ] Supabase CLI (opcional, mas recomendado)

## 📦 Passo 1: Preparação do Projeto

### 1.1 Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/suse-df.git
cd suse-df
```

### 1.2 Estrutura do Projeto
```
suse-df/
├── apps/
│   ├── web/                    # Dashboard React
│   └── biometry-service/         # Serviço Python de biometria
├── backend/                      # Scripts SQL
├── supabase/
│   └── functions/               # Edge Functions
└── README.md
```

## 🔧 Passo 2: Configuração do Supabase

### 2.1 Criar Projeto no Supabase
1. Acesse https://supabase.com
2. Clique em "New Project"
3. Configure:
   - **Name:** `suse-df-prod`
   - **Database Password:** Use uma senha forte e salve em local seguro
   - **Region:** Escolha a mais próxima (us-east-1 recomendado)
4. Aguarde a criação (pode levar 2-3 minutos)

### 2.2 Obter Credenciais
1. Vá para **Settings > API**
2. Copie e salve:
   - **Project URL** (ex: `https://knuhnorzaxxbnwekmjxg.supabase.co`)
   - **anon/public key**
   - **service_role key** (mantenha em segurança!)

## 🗄️ Passo 3: Configuração do Banco de Dados

### 3.1 Conectar ao Banco
1. No dashboard do Supabase, vá para **SQL Editor**
2. Execute os scripts na ordem EXATA especificada abaixo

### 3.2 Ordem de Execução dos Scripts SQL

#### 🔸 Script 1: Estrutura Base (schema.sql)
```sql
-- Executar: backend/schema.sql
-- Este script cria a estrutura básica do banco

-- Enum para níveis de acesso dos atendentes
CREATE TYPE staff_role AS ENUM ('operator', 'supervisor', 'admin', 'master');

-- Tabela de Usuários (Motoristas)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(100) NOT NULL,
  secret_word VARCHAR(50) NOT NULL,
  vehicle_info JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  secret_word_audio_url TEXT,
  voice_biometry_1_url TEXT,
  voice_biometry_2_url TEXT,
  voice_biometry_3_url TEXT,
  matricula VARCHAR(20)
);

CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_active ON users(is_active);

-- Tabela de Staff (Atendentes)
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role staff_role DEFAULT 'operator',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_staff_email ON staff(email);
CREATE INDEX idx_staff_role ON staff(role);

-- Tabela de Alertas de Emergência
CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  attendant_id UUID REFERENCES staff(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'cancelled', 'waiting_police_validation')),
  trigger_type VARCHAR(20) CHECK (trigger_type IN ('voice', 'button', 'geofence_violation', 'dead_zone_entry')),
  initial_lat DECIMAL(10, 8) NOT NULL,
  initial_lng DECIMAL(11, 8) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  termination_token_hash TEXT,
  termination_token_salt TEXT,
  termination_token_expires_at TIMESTAMP WITH TIME ZONE,
  termination_token_attempts INT DEFAULT 0,
  validating_police_officer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_status ON emergency_alerts(status);
CREATE INDEX idx_alerts_user ON emergency_alerts(user_id);
CREATE INDEX idx_alerts_started ON emergency_alerts(started_at DESC);

-- Tabela de Atualizações de Localização
CREATE TABLE location_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES emergency_alerts(id),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy FLOAT,
  speed FLOAT,
  heading FLOAT,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_locations_alert ON location_updates(alert_id);
CREATE INDEX idx_locations_recorded ON location_updates(recorded_at DESC);

-- Tabela de Links de Compartilhamento
CREATE TABLE share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES emergency_alerts(id),
  created_by UUID REFERENCES staff(id),
  share_token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_share_links_token ON share_links(share_token);
CREATE INDEX idx_share_links_active ON share_links(is_active);
```

#### 🔸 Script 2: Habilitar Extensões
```sql
-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
```

#### 🔸 Script 3: Configurar RLS (Segurança)
```sql
-- Habilitar RLS nas tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Políticas básicas
CREATE POLICY "Users view own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Staff view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "Staff view all alerts" ON emergency_alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users view own alerts" ON emergency_alerts
    FOR SELECT USING (user_id = auth.uid());
```

#### 🔸 Script 4: Sistema de Auditoria
```sql
-- Tabela de Auditoria
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    target_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read audit" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM staff 
            WHERE staff.email = (SELECT email FROM auth.users WHERE id = auth.uid()) 
            AND staff.role IN ('admin', 'master', 'supervisor')
        )
    );

CREATE POLICY "Authenticated insert audit" ON audit_logs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

#### 🔸 Script 5: Sistema de Tokens de Encerramento
```sql
-- Função para gerar token de encerramento
CREATE OR REPLACE FUNCTION generate_termination_token(p_alert_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token TEXT;
    v_salt TEXT;
    v_hash TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Gerar token de 8 caracteres
    v_token := upper(substring(encode(gen_random_bytes(6), 'hex') from 1 for 8));
    
    -- Gerar salt
    v_salt := encode(gen_random_bytes(16), 'hex');
    
    -- Calcular hash (SHA256 do Token + Salt)
    v_hash := encode(digest(v_token || v_salt, 'sha256'), 'hex');
    
    -- Definir expiração (60 minutos)
    v_expires_at := NOW() + INTERVAL '60 minutes';
    
    -- Atualizar alerta
    UPDATE public.emergency_alerts
    SET 
        termination_token_hash = v_hash,
        termination_token_salt = v_salt,
        termination_token_expires_at = v_expires_at,
        termination_token_attempts = 0,
        status = 'waiting_police_validation',
        termination_requested_at = NOW()
    WHERE id = p_alert_id;
    
    RETURN v_token;
END;
$$;

-- Função para validar token
CREATE OR REPLACE FUNCTION validate_termination_token(p_alert_id UUID, p_token TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stored_hash TEXT;
    v_stored_salt TEXT;
    v_expires_at TIMESTAMP WITH TIME ZONE;
    v_attempts INT;
    v_calculated_hash TEXT;
BEGIN
    -- Buscar dados do token
    SELECT 
        termination_token_hash,
        termination_token_salt,
        termination_token_expires_at,
        termination_token_attempts
    INTO 
        v_stored_hash,
        v_stored_salt,
        v_expires_at,
        v_attempts
    FROM public.emergency_alerts
    WHERE id = p_alert_id;
    
    -- Verificar se existe token
    IF v_stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar expiração
    IF NOW() > v_expires_at THEN
        RETURN FALSE;
    END IF;
    
    -- Verificar tentativas (máximo 3)
    IF v_attempts >= 3 THEN
        RETURN FALSE;
    END IF;
    
    -- Calcular hash do token fornecido
    v_calculated_hash := encode(digest(p_token || v_stored_salt, 'sha256'), 'hex');
    
    -- Verificar match
    IF v_calculated_hash = v_stored_hash THEN
        -- Token válido, atualizar status
        UPDATE public.emergency_alerts
        SET 
            status = 'resolved',
            resolved_at = NOW()
        WHERE id = p_alert_id;
        
        RETURN TRUE;
    ELSE
        -- Incrementar tentativas
        UPDATE public.emergency_alerts
        SET termination_token_attempts = v_attempts + 1
        WHERE id = p_alert_id;
        
        RETURN FALSE;
    END IF;
END;
$$;
```

#### 🔸 Script 6: Sistema de Geolocalização (PostGIS)
```sql
-- Adicionar colunas de geografia
ALTER TABLE location_updates 
ADD COLUMN IF NOT EXISTS geom GEOGRAPHY(POINT, 4326);

ALTER TABLE emergency_alerts 
ADD COLUMN IF NOT EXISTS initial_geom GEOGRAPHY(POINT, 4326);

-- Função para sincronizar geometria
CREATE OR REPLACE FUNCTION sync_geom_from_latlng()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
        NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::GEOGRAPHY;
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger para sincronização automática
CREATE TRIGGER trigger_sync_location_geom
    BEFORE INSERT OR UPDATE ON location_updates
    FOR EACH ROW
    EXECUTE FUNCTION sync_geom_from_latlng();

CREATE TRIGGER trigger_sync_alert_geom
    BEFORE INSERT OR UPDATE ON emergency_alerts
    FOR EACH ROW
    EXECUTE FUNCTION sync_geom_from_latlng();
```

#### 🔸 Script 7: Sistema de Compartilhamento
```sql
-- Tabelas para compartilhamento externo
CREATE TABLE authorized_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    organization TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE share_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    alert_id UUID REFERENCES emergency_alerts(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES authorized_agents(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_share_tokens_token ON share_tokens(token);
CREATE INDEX idx_share_tokens_expires ON share_tokens(expires_at);

-- Função para gerar link de compartilhamento
CREATE OR REPLACE FUNCTION generate_share_link(
    p_alert_id UUID,
    p_agent_name TEXT,
    p_agent_phone TEXT,
    p_agent_org TEXT,
    p_duration_minutes INT DEFAULT 30
)
RETURNS TABLE (
    share_url TEXT,
    token TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agent_id UUID;
    v_token TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Criar ou buscar agente
    SELECT id INTO v_agent_id
    FROM authorized_agents
    WHERE phone = p_agent_phone
    LIMIT 1;
    
    IF v_agent_id IS NULL THEN
        INSERT INTO authorized_agents (name, phone, organization)
        VALUES (p_agent_name, p_agent_phone, p_agent_org)
        RETURNING id INTO v_agent_id;
    END IF;
    
    -- Gerar token e expiração
    v_token := encode(gen_random_bytes(16), 'hex');
    v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
    
    -- Criar share token
    INSERT INTO share_tokens (alert_id, agent_id, created_by, token, expires_at)
    VALUES (p_alert_id, v_agent_id, auth.uid(), v_token, v_expires_at);
    
    RETURN QUERY
    SELECT 
        'https://suse-df.vercel.app/shared/' || v_token,
        v_token,
        v_expires_at;
END;
$$;
```

#### 🔸 Script 8: Sistema de Voz e Biometria
```sql
-- Configurar storage para áudios
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-recordings', 'voice-recordings', true, 5242880, ARRAY['audio/wav', 'audio/mpeg', 'audio/ogg'])
ON CONFLICT (id) DO NOTHING;

-- Permissões do storage
CREATE POLICY "Users can upload own voice recordings" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'voice-recordings' 
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "Users can read own voice recordings" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'voice-recordings' 
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "Staff can read voice recordings" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'voice-recordings'
        AND EXISTS (
            SELECT 1 FROM staff 
            WHERE staff.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );
```

#### 🔸 Script 9: Dados Iniciais e Teste
```sql
-- Inserir regiões do DF (exemplo simplificado)
INSERT INTO administrative_regions (name, type, geometry) VALUES
('Plano Piloto', 'administrative_region', ST_GeomFromText('POLYGON((-47.9 -15.8, -47.8 -15.8, -47.8 -15.7, -47.9 -15.7, -47.9 -15.8))', 4326)),
('Taguatinga', 'administrative_region', ST_GeomFromText('POLYGON((-48.1 -15.8, -48.0 -15.8, -48.0 -15.7, -48.1 -15.7, -48.1 -15.8))', 4326)),
('Ceilândia', 'administrative_region', ST_GeomFromText('POLYGON((-48.3 -15.9, -48.2 -15.9, -48.2 -15.8, -48.3 -15.8, -48.3 -15.9))', 4326));

-- Criar zonas de sombra (áreas sem sinal)
INSERT INTO dead_zones (name, description, geometry) VALUES
('Túnel da Estrada Parque', 'Túnel com perda de sinal', ST_GeomFromText('POLYGON((-47.85 -15.75, -47.84 -15.75, -47.84 -15.74, -47.85 -15.74, -47.85 -15.75))', 4326)),
('Serra do Mar', 'Área montanhosa com sinal limitado', ST_GeomFromText('POLYGON((-48.5 -16.0, -48.4 -16.0, -48.4 -15.9, -48.5 -15.9, -48.5 -16.0))', 4326));

-- Criar usuário de teste (será substituído por auth.users)
-- Este é apenas um placeholder - o usuário real será criado pelo sistema de auth
```

#### 🔸 Script 10: Permissões Finais
```sql
-- Conceder permissões básicas
GRANT SELECT ON users TO anon;
GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT SELECT ON staff TO authenticated;
GRANT ALL PRIVILEGES ON staff TO authenticated;
GRANT SELECT ON emergency_alerts TO anon;
GRANT ALL PRIVILEGES ON emergency_alerts TO authenticated;
GRANT SELECT ON location_updates TO authenticated;
GRANT ALL PRIVILEGES ON location_updates TO authenticated;
GRANT SELECT ON audit_logs TO authenticated;
GRANT INSERT ON audit_logs TO authenticated;
```

## 🔧 Passo 4: Configuração do Frontend

### 4.1 Configurar Variáveis de Ambiente
```bash
cd apps/web

# Criar arquivo .env.local
cat > .env.local << EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
EOF
```

### 4.2 Instalar Dependências
```bash
npm install
```

### 4.3 Testar Localmente
```bash
npm run dev
```

## 🐍 Passo 5: Configuração do Serviço Python

### 5.1 Configurar Variáveis de Ambiente
```bash
cd apps/biometry-service

# Criar arquivo .env
cat > .env << EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key-here
PORT=8000
EOF
```

### 5.2 Instalar Dependências
```bash
pip install -r requirements.txt
```

### 5.3 Testar Localmente
```bash
python main.py
```

## 🚀 Passo 6: Deploy na Nuvem

### 6.1 Deploy do Frontend (Vercel)
1. Acesse https://vercel.com
2. Importe o repositório do GitHub
3. Configure:
   - **Root Directory:** `apps/web`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Adicione as variáveis de ambiente
5. Deploy!

### 6.2 Deploy do Serviço Python (Railway)
1. Acesse https://railway.app
2. Crie novo projeto
3. Conecte ao GitHub
4. Configure:
   - **Root Directory:** `apps/biometry-service`
   - **Runtime:** Python
5. Adicione as variáveis de ambiente
6. Deploy!

### 6.3 Deploy das Edge Functions (Supabase)
```bash
# Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# Fazer login
supabase login

# Linkar ao projeto
supabase link --project-ref your-project-ref

# Deploy das functions
supabase functions deploy trigger-emergency
supabase functions deploy verify-biometry
```

## ✅ Passo 7: Testes e Validação

### 7.1 Testar Autenticação
1. Acesse o dashboard web
2. Tente fazer login com credenciais inválidas
3. Verifique se aparecem nos logs de auditoria

### 7.2 Testar Criação de Alerta
1. Use o app mobile ou dashboard de motorista
2. Acione um alerta de teste
3. Verifique se aparece no dashboard central
4. Confirme se a localização está correta

### 7.3 Testar Biometria de Voz
1. Grave uma amostra de voz
2. Configure a frase secreta
3. Teste o reconhecimento
4. Verifique os logs do serviço Python

### 7.4 Testar Token de Encerramento
1. Crie um alerta de teste
2. Gere um token de encerramento
3. Tente validar com token incorreto (máximo 3 tentativas)
4. Valide com token correto
5. Verifique se o alerta foi encerrado

### 7.5 Testar Compartilhamento
1. Crie um link de compartilhamento
2. Acesse em navegador anônimo
3. Verifique se expira após o tempo configurado
4. Confirme se os dados estão limitados ao necessário

## 📊 Passo 8: Monitoramento

### 8.1 Verificar Health Checks
- **Frontend:** https://sua-url.vercel.app/api/health
- **Python:** https://sua-url.railway.app/
- **Supabase:** Dashboard > Project Settings

### 8.2 Configurar Alertas
1. Supabase Dashboard > Settings > Database > Webhooks
2. Configure webhooks para eventos críticos
3. Configure email de alertas

## 🔒 Passo 9: Segurança

### 9.1 Verificar Permissões
```sql
-- Verificar se RLS está ativo em todas as tabelas
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'staff', 'emergency_alerts', 'location_updates');
```

### 9.2 Revisar Logs de Auditoria
```sql
-- Ver últimas ações
SELECT action, actor_id, created_at 
FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### 9.3 Atualizar Tokens
- **Service Role Key:** Renove regularmente
- **JWT Secret:** Configure no Supabase
- **API Keys:** Use diferentes para diferentes ambientes

## 🆘 Solução de Problemas

### Problema: "Erro de conexão com banco"
**Solução:** Verifique as políticas RLS e as permissões do usuário autenticado

### Problema: "Biometria não funciona"
**Solução:** Verifique se o serviço Python está rodando e se as variáveis de ambiente estão corretas

### Problema: "Alertas não aparecem no dashboard"
**Solução:** Verifique as políticas RLS e se o usuário tem permissão de staff

### Problema: "Token de encerramento inválido"
**Solução:** Verifique a expiração (60 minutos) e número de tentativas (máximo 3)

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no Supabase Dashboard
2. Confira as variáveis de ambiente
3. Execute os testes na ordem especificada
4. Documente o erro completo antes de solicitar ajuda

## 🎉 Parabéns!

Seu Sistema SUSE-DF está completo e operacional! 🚀

Lembre-se de:
- [ ] Configurar backup automático
- [ ] Monitorar uso de recursos
- [ ] Manter dependências atualizadas
- [ ] Revisar logs regularmente
- [ ] Testar recuperação de desastres
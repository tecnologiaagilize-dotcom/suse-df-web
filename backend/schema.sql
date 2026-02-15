-- Atualização do Schema para suportar hierarquia de papéis
-- Baseado no sistema-socorro-arquitetura.md mas com refinamento de roles

-- Enum para níveis de acesso dos atendentes
CREATE TYPE staff_role AS ENUM ('operator', 'supervisor', 'admin');
-- operator: Operador da Mesa de Atendimento
-- supervisor: Chefe de Atendimento
-- admin: Supervisor do Sistema

-- Tabela de Usuários (Motoristas)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  name VARCHAR(100) NOT NULL,
  secret_word VARCHAR(50) NOT NULL, -- Palavra chave para socorro
  vehicle_info JSONB, -- Informações do veículo (opcional, já que é Motorista)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_phone ON users(phone_number);

-- Tabela de Staff (Atendentes, Chefes, Supervisores)
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

-- Tabela de Alertas de Emergência
CREATE TABLE emergency_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  attendant_id UUID REFERENCES staff(id), -- Quem atendeu
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'investigating', 'resolved', 'cancelled')),
  trigger_type VARCHAR(20) CHECK (trigger_type IN ('voice', 'button')),
  initial_lat DECIMAL(10, 8) NOT NULL,
  initial_lng DECIMAL(11, 8) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_status ON emergency_alerts(status);
CREATE INDEX idx_alerts_user ON emergency_alerts(user_id);

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
  created_by UUID REFERENCES staff(id), -- Quem gerou o link (pode ser operador ou superior)
  share_token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Políticas de Segurança (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Exemplo de Policies (Simplificado)
-- Staff pode ver tudo
CREATE POLICY "Staff view all alerts" ON emergency_alerts FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

-- Motorista vê apenas seus alertas
CREATE POLICY "Users view own alerts" ON emergency_alerts FOR SELECT TO authenticated USING (
  user_id = auth.uid()
);

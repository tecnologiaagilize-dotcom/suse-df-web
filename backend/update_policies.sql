-- Habilitar RLS nas tabelas (caso não esteja)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_updates ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS PARA A TABELA USERS
-- Permitir que o usuário insira seus próprios dados durante o cadastro (ou via trigger, mas insert direto é comum)
CREATE POLICY "Users can insert their own profile" 
ON users FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Permitir que o usuário veja seu próprio perfil
CREATE POLICY "Users can view own profile" 
ON users FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Permitir que o usuário atualize seu próprio perfil
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- POLÍTICAS PARA A TABELA EMERGENCY_ALERTS
-- Permitir que usuários autenticados criem alertas (SOS)
-- A regra CHECK garante que eles só podem criar alertas vinculados ao seu próprio ID
CREATE POLICY "Users can create alerts" 
ON emergency_alerts FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Permitir que usuários vejam seus próprios alertas
CREATE POLICY "Users can view own alerts" 
ON emergency_alerts FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- POLÍTICAS PARA A TABELA LOCATION_UPDATES
-- Permitir inserção de localização para alertas que pertencem ao usuário
CREATE POLICY "Users can insert location updates" 
ON location_updates FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM emergency_alerts 
    WHERE id = alert_id 
    AND user_id = auth.uid()
  )
);

-- STAFF / ADMIN POLICIES (Simplificadas para permitir monitoramento)
-- Permitir que qualquer usuário autenticado leia a tabela staff para verificar permissões (leitura pública interna ou restrita)
-- Nota: Idealmente restrito, mas para checagem de role no frontend às vezes é necessário.
-- Melhor: Criar política onde Staff pode ver tudo.

CREATE POLICY "Staff can view all users" 
ON users FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

CREATE POLICY "Staff can view all alerts" 
ON emergency_alerts FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

CREATE POLICY "Staff can update alerts" 
ON emergency_alerts FOR UPDATE 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

CREATE POLICY "Staff can view all locations" 
ON location_updates FOR SELECT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid())
);

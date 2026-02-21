-- Tabela de Auditoria (Garantia de Existência)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  target_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para Performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Habilitar RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Apenas Staff (Operadores, Admins, etc) podem ver
-- Correção: Referenciar tabela 'staff' em vez de view inexistente 'staff_users'
-- Correção 2: Drop policy if exists para evitar erro 42710
DROP POLICY IF EXISTS "Staff read audit" ON audit_logs;
CREATE POLICY "Staff read audit" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff 
      WHERE staff.email = (select email from auth.users where id = auth.uid()) 
      AND staff.role IN ('admin', 'master', 'supervisor')
    )
  );

-- Política de Inserção: Qualquer usuário autenticado (Sistema registra ações deles)
DROP POLICY IF EXISTS "Staff insert audit" ON audit_logs;
CREATE POLICY "Staff insert audit" ON audit_logs
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Função RPC para Inserir Log (Simplifica chamada do Frontend)
CREATE OR REPLACE FUNCTION log_action(
  p_action TEXT,
  p_target_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com permissões elevadas para garantir o log
AS $$
DECLARE
  v_log_id UUID;
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();
  
  INSERT INTO audit_logs (action, actor_id, target_id, metadata)
  VALUES (p_action, v_actor_id, p_target_id, p_metadata)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Função RPC para Consultar Logs com Filtros (Para o Dashboard)
-- Correção: Referenciar tabela 'staff' em vez de 'staff_users'
CREATE OR REPLACE FUNCTION get_audit_logs(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_action TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  actor_email TEXT,
  actor_role TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifica permissão (apenas admin/master/supervisor)
  IF NOT EXISTS (
      SELECT 1 FROM staff 
      WHERE email = (select email from auth.users where id = auth.uid()) 
      AND role IN ('admin', 'master', 'supervisor')
  ) THEN
      RAISE EXCEPTION 'Acesso negado aos logs de auditoria.';
  END IF;

  RETURN QUERY
  SELECT 
    l.id,
    l.action,
    u.email as actor_email,
    s.role as actor_role,
    l.target_id,
    l.metadata,
    l.created_at
  FROM audit_logs l
  LEFT JOIN auth.users u ON l.actor_id = u.id
  -- Join com Staff via Email, pois auth.id pode não estar na tabela staff diretamente
  -- (Depende da implementação de auth, mas email é o vínculo comum)
  LEFT JOIN staff s ON u.email = s.email
  WHERE (p_action IS NULL OR l.action = p_action)
  AND (p_actor_id IS NULL OR l.actor_id = p_actor_id)
  ORDER BY l.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

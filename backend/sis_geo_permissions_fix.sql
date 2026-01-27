-- Script de permissões permissivas para SIS_GEO
-- Use este script se as políticas restritivas estiverem bloqueando a criação de links

-- 1. Conceder permissão de execução nas funções para usuários autenticados
GRANT EXECUTE ON FUNCTION generate_share_link(UUID, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_share_link(UUID, TEXT, TEXT, INT) TO service_role;

GRANT EXECUTE ON FUNCTION get_shared_alert_data(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_alert_data(TEXT) TO anon; -- Necessário para acesso público
GRANT EXECUTE ON FUNCTION get_shared_alert_data(TEXT) TO service_role;

-- 2. Conceder permissões nas tabelas (se RLS falhar, SECURITY DEFINER nas funções deve resolver, mas isso é backup)
GRANT ALL ON authorized_agents TO authenticated;
GRANT ALL ON share_tokens TO authenticated;
GRANT ALL ON audit_logs TO authenticated;

-- 3. Política de "Vale-Tudo" para debug (apenas se o erro persistir)
-- DROP POLICY IF EXISTS "Enable all access for authenticated users" ON authorized_agents;
-- CREATE POLICY "Enable all access for authenticated users" ON authorized_agents FOR ALL TO authenticated USING (true);

-- DROP POLICY IF EXISTS "Enable all access for authenticated users" ON share_tokens;
-- CREATE POLICY "Enable all access for authenticated users" ON share_tokens FOR ALL TO authenticated USING (true);

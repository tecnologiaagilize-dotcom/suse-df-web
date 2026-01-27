-- DESATIVAR RLS TEMPORARIAMENTE PARA TESTE
-- Isso permite que qualquer usuário autenticado (ou até anônimo dependendo da config) leia a tabela
ALTER TABLE emergency_alerts DISABLE ROW LEVEL SECURITY;

-- Se funcionar após isso, o problema era 100% nas Policies.
-- Depois do teste, lembre-se de reativar: ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;

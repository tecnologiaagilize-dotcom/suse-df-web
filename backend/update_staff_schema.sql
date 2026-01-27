-- Atualização da tabela staff para suportar matrícula e troca de senha
ALTER TABLE staff ADD COLUMN IF NOT EXISTS matricula VARCHAR(50) UNIQUE;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Atualizar o ENUM se possível (Postgres não deixa adicionar facilmente em enum existente dentro de transação em alguns casos, 
-- mas vamos tentar ou usar CHECK constraint se falhar. 
-- Como é difícil alterar ENUM em tempo de execução sem recriar, vamos assumir que 'admin' serve para o Master ou inserir 'master'.)
-- Opção segura: Adicionar valor ao tipo enum fora de transação se possível.
-- ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'master'; 
-- (Comando acima pode falhar dependendo da versão/contexto, vou usar 'admin' para o Master por enquanto e diferenciar pelo nome ou flag is_master)

-- Melhor: Adicionar uma coluna is_master ou apenas confiar no role 'admin' sendo o nível mais alto.
-- O usuário pediu "mais um perfil", então vou tentar adicionar o valor ao enum.
DO $$
BEGIN
    ALTER TYPE staff_role ADD VALUE 'master';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar ou Atualizar o usuário Mastersuse
-- Matrícula: mastersuse
-- Senha: teste123 (será definida no Auth, aqui só o registro no banco)

-- 1. Inserir na tabela Staff (Vincularemos ao ID do Auth depois ou criaremos um dummy se o Auth não estiver pronto)
-- Nota: Para funcionar o login, precisa existir no Auth.users. 
-- Vou criar um script separado para "Criar Master" que o usuário deve rodar, pois envolve Auth.

-- Política para permitir que o Master (admin/master) crie outros usuários na tabela staff
CREATE POLICY "Master can insert staff" 
ON staff FOR INSERT 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid() AND role = 'master')
);

CREATE POLICY "Master can update staff" 
ON staff FOR UPDATE 
TO authenticated 
USING (
  EXISTS (SELECT 1 FROM staff WHERE id = auth.uid() AND role = 'master')
);

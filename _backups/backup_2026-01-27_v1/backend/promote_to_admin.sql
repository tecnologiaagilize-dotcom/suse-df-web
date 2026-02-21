-- Script para promover um usuário existente a Staff (Admin/Operador)
-- Substitua 'seu-email@exemplo.com' pelo email do usuário que você cadastrou

DO $$
DECLARE
  target_email TEXT := 'admin@suse.df.gov.br'; -- COLOQUE O EMAIL AQUI
  user_uuid UUID;
BEGIN
  -- 1. Buscar o ID do usuário no Auth
  SELECT id INTO user_uuid FROM auth.users WHERE email = target_email;

  IF user_uuid IS NULL THEN
    RAISE NOTICE 'Usuário não encontrado em auth.users. Cadastre-se primeiro pela tela de registro.';
    RETURN;
  END IF;

  -- 2. Inserir na tabela Staff (se não existir)
  INSERT INTO staff (id, email, name, role)
  VALUES (
    user_uuid, 
    target_email, 
    'Administrador', -- Nome padrão
    'admin' -- Pode ser 'operator', 'supervisor' ou 'admin'
  )
  ON CONFLICT (id) DO UPDATE 
  SET role = 'admin'; -- Atualiza se já existir

  -- 3. Remover da tabela de motoristas (users) para evitar conflito de papéis
  DELETE FROM users WHERE id = user_uuid;

  RAISE NOTICE 'Usuário % promovido a ADMIN com sucesso.', target_email;
END $$;

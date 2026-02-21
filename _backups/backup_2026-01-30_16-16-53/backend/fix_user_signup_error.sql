-- Correção Crítica para Erro "Database error saving new user"
-- Ocorre porque campos obrigatórios (NOT NULL) não estavam sendo preenchidos pelo trigger

-- 1. Remover obrigatoriedade de campos que podem não vir no cadastro inicial
ALTER TABLE public.users ALTER COLUMN secret_word DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN secret_word SET DEFAULT 'socorro'; -- Valor padrão seguro

ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL; -- Permite cadastro só com email

-- Garantir que outros campos adicionados depois também não bloqueiem
ALTER TABLE public.users ALTER COLUMN name DROP NOT NULL; -- Fallback para email se necessário

-- 2. Recriar o Trigger com tratamento melhor de dados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    email, 
    name, 
    phone_number, 
    secret_word, 
    created_at
  )
  VALUES (
    new.id,
    new.email,
    -- Nome: Tenta metadata, depois email, depois 'Usuário'
    COALESCE(new.raw_user_meta_data->>'name', new.email, 'Novo Usuário'),
    -- Telefone: Tenta metadata, ou deixa NULL (agora permitido)
    NULLIF(new.raw_user_meta_data->>'phone_number', ''),
    -- Palavra Secreta: Tenta metadata, ou usa padrão
    COALESCE(new.raw_user_meta_data->>'emergency_phrase', 'socorro'),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    name = COALESCE(public.users.name, excluded.name); -- Preserva nome se já existir
    
  RETURN new;
END;
$$;

-- 3. Reaplicar o Trigger (caso tenha sido removido ou modificado)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

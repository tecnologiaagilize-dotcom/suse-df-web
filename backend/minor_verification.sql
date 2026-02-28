-- Atualização da Tabela de Usuários para suportar Menores de Idade
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS guardian_info JSONB, -- { name, cpf, phone, email, token, verified }
ADD COLUMN IF NOT EXISTS is_minor BOOLEAN DEFAULT false;

-- Função para verificar se é menor de idade (baseado na data de nascimento)
CREATE OR REPLACE FUNCTION check_is_minor()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL THEN
    IF AGE(NEW.birth_date) < INTERVAL '18 years' THEN
      NEW.is_minor := true;
    ELSE
      NEW.is_minor := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar is_minor automaticamente
DROP TRIGGER IF EXISTS trg_check_minor ON users;
CREATE TRIGGER trg_check_minor
BEFORE INSERT OR UPDATE OF birth_date ON users
FOR EACH ROW EXECUTE FUNCTION check_is_minor();

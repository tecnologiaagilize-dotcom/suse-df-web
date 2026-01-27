-- Atualização da tabela authorized_agents para incluir novos campos do Chefe de Viatura

ALTER TABLE authorized_agents 
ADD COLUMN IF NOT EXISTS matricula TEXT,
ADD COLUMN IF NOT EXISTS posto_graduacao TEXT,
ADD COLUMN IF NOT EXISTS lotacao TEXT,
ADD COLUMN IF NOT EXISTS viatura TEXT,
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Comentários para documentação
COMMENT ON COLUMN authorized_agents.matricula IS 'Matrícula do agente';
COMMENT ON COLUMN authorized_agents.posto_graduacao IS 'Posto ou graduação (ex: Soldado, Cabo, Capitão)';
COMMENT ON COLUMN authorized_agents.lotacao IS 'Unidade de lotação do agente';
COMMENT ON COLUMN authorized_agents.viatura IS 'Identificação da viatura';
COMMENT ON COLUMN authorized_agents.observacoes IS 'Observações gerais';

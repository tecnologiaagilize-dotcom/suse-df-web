-- Atualizar tabela para suportar categorização
ALTER TABLE administrative_regions ADD COLUMN IF NOT EXISTS category TEXT; -- 'DF', 'ENTORNO', 'ESTADO'
ALTER TABLE administrative_regions ADD COLUMN IF NOT EXISTS state_code TEXT; -- 'DF', 'GO', 'MG'

-- Limpar dados antigos de teste para reinserir limpo
DELETE FROM administrative_regions;

-- 1. Regiões Administrativas do DF (Lista Completa)
INSERT INTO administrative_regions (name, category, state_code, risk_level) VALUES
('Plano Piloto', 'DF', 'DF', 'LOW'),
('Gama', 'DF', 'DF', 'MEDIUM'),
('Taguatinga', 'DF', 'DF', 'MEDIUM'),
('Brazlândia', 'DF', 'DF', 'LOW'),
('Sobradinho', 'DF', 'DF', 'LOW'),
('Planaltina', 'DF', 'DF', 'MEDIUM'),
('Paranoá', 'DF', 'DF', 'MEDIUM'),
('Núcleo Bandeirante', 'DF', 'DF', 'LOW'),
('Ceilândia', 'DF', 'DF', 'HIGH'),
('Guará', 'DF', 'DF', 'LOW'),
('Cruzeiro', 'DF', 'DF', 'LOW'),
('Samambaia', 'DF', 'DF', 'HIGH'),
('Santa Maria', 'DF', 'DF', 'MEDIUM'),
('São Sebastião', 'DF', 'DF', 'MEDIUM'),
('Recanto das Emas', 'DF', 'DF', 'MEDIUM'),
('Lago Sul', 'DF', 'DF', 'LOW'),
('Riacho Fundo', 'DF', 'DF', 'MEDIUM'),
('Lago Norte', 'DF', 'DF', 'LOW'),
('Candangolândia', 'DF', 'DF', 'LOW'),
('Águas Claras', 'DF', 'DF', 'LOW'),
('Riacho Fundo II', 'DF', 'DF', 'MEDIUM'),
('Sudoeste/Octogonal', 'DF', 'DF', 'LOW'),
('Varjão', 'DF', 'DF', 'LOW'),
('Park Way', 'DF', 'DF', 'LOW'),
('SCIA (Estrutural)', 'DF', 'DF', 'HIGH'),
('Sobradinho II', 'DF', 'DF', 'LOW'),
('Jardim Botânico', 'DF', 'DF', 'LOW'),
('Itapoã', 'DF', 'DF', 'MEDIUM'),
('SIA', 'DF', 'DF', 'LOW'),
('Vicente Pires', 'DF', 'DF', 'LOW'),
('Fercal', 'DF', 'DF', 'LOW'),
('Sol Nascente/Pôr do Sol', 'DF', 'DF', 'HIGH'),
('Arniqueira', 'DF', 'DF', 'LOW');

-- 2. Cidades do Entorno (Goiás) - Lista Específica Solicitada
INSERT INTO administrative_regions (name, category, state_code, risk_level) VALUES
('Valparaíso de Goiás', 'ENTORNO', 'GO', 'MEDIUM'),
('Cidade Ocidental', 'ENTORNO', 'GO', 'MEDIUM'),
('Novo Gama', 'ENTORNO', 'GO', 'HIGH'),
('Luziânia', 'ENTORNO', 'GO', 'HIGH'),
('Planaltina de Goiás', 'ENTORNO', 'GO', 'MEDIUM'),
('Padre Bernardo', 'ENTORNO', 'GO', 'LOW'),
('Águas Lindas de Goiás', 'ENTORNO', 'GO', 'HIGH'),
('Santo Antônio do Descoberto', 'ENTORNO', 'GO', 'MEDIUM');

-- 3. Outros Estados (Fronteira/Raio)
INSERT INTO administrative_regions (name, category, state_code, risk_level) VALUES
('Goiás (Raio 300km)', 'ESTADO', 'GO', 'LOW'),
('Minas Gerais (Raio 300km - Unaí/Paracatu)', 'ESTADO', 'MG', 'LOW');

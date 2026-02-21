-- Script para atualizar a tabela USERS (Motoristas)
-- Adiciona colunas faltantes para o perfil completo

-- Adicionar coluna de endereço (JSONB para guardar rua, cep, etc)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}'::jsonb;

-- Garantir outras colunas que o perfil usa
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS cpf VARCHAR(20),
ADD COLUMN IF NOT EXISTS cnh VARCHAR(20),
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS car_brand VARCHAR(50),
ADD COLUMN IF NOT EXISTS car_model VARCHAR(50),
ADD COLUMN IF NOT EXISTS car_plate VARCHAR(20),
ADD COLUMN IF NOT EXISTS car_color VARCHAR(20),
ADD COLUMN IF NOT EXISTS emergency_contacts JSONB DEFAULT '[]'::jsonb;

-- Se precisar aumentar o tamanho de algum campo existente:
ALTER TABLE public.users ALTER COLUMN name TYPE VARCHAR(255);

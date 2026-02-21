-- Script para aumentar o tamanho das colunas da tabela USERS
-- Evita erro "value too long for type character varying(20)"

-- Foto URL deve ser TEXT pois Base64 ou URLs longas ocupam muito espaço
ALTER TABLE public.users ALTER COLUMN photo_url TYPE TEXT;

-- Aumentar margem de segurança para outros campos
ALTER TABLE public.users ALTER COLUMN secret_word TYPE VARCHAR(255);
ALTER TABLE public.users ALTER COLUMN car_brand TYPE VARCHAR(100);
ALTER TABLE public.users ALTER COLUMN car_model TYPE VARCHAR(100);
ALTER TABLE public.users ALTER COLUMN car_color TYPE VARCHAR(50);
ALTER TABLE public.users ALTER COLUMN phone_number TYPE VARCHAR(50);
ALTER TABLE public.users ALTER COLUMN cpf TYPE VARCHAR(50);
ALTER TABLE public.users ALTER COLUMN cnh TYPE VARCHAR(50);

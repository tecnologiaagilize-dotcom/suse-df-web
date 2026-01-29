-- Script para popular usuários administrativos (SEED) - VERSÃO BLINDADA COM ENUM UPDATE
-- Senha padrão para todos: teste123

-- 0. Corrigir estrutura da tabela STAFF e ENUM antes de tudo
DO $$
BEGIN
    -- Se existir coluna 'name', renomear para 'full_name' para padronizar
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='name') THEN
        ALTER TABLE public.staff RENAME COLUMN name TO full_name;
    END IF;

    -- Garantir que 'full_name' exista
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS full_name TEXT;
    
    -- Garantir que 'matricula' exista
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS matricula VARCHAR(20) UNIQUE;
    
    -- Garantir que 'status' exista
    ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

    -- Adicionar valor 'master' ao ENUM staff_role se não existir
    -- Nota: ALTER TYPE não suporta IF NOT EXISTS diretamente em versões antigas, 
    -- então usamos um bloco exception ou verificação.
    -- No Supabase (Postgres recente), podemos tentar adicionar e ignorar erro se já existir.
    BEGIN
        ALTER TYPE staff_role ADD VALUE 'master';
    EXCEPTION
        WHEN duplicate_object THEN NULL; -- Já existe, ignora
    END;

END $$;

-- Início do Script de Criação de Usuários
DO $$
DECLARE
  v_users text[][] := ARRAY[
    ['000001', 'operator', 'Operador da Mesa'],
    ['000002', 'supervisor', 'Chefe de Atendimento'],
    ['000003', 'admin', 'Supervisor do Sistema'],
    ['999999', 'master', 'Administrador Master']
  ];
  v_user_record text[];
  v_email text;
  v_password text := 'teste123';
  v_user_id uuid;
BEGIN
  -- Garantir que a extensão de criptografia esteja ativa
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  FOREACH v_user_record SLICE 1 IN ARRAY v_users
  LOOP
    v_email := v_user_record[1] || '@suse.sys';
    
    -- 1. Tentar encontrar usuário no Auth
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    -- 2. Se não existir, criar no Auth
    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, recovery_sent_at, last_sign_in_at, 
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        v_email,
        crypt(v_password, gen_salt('bf')),
        NOW(), NOW(), NOW(),
        '{"provider":"email","providers":["email"]}',
        '{}',
        NOW(), NOW()
      );

      -- Criar identidade
      INSERT INTO auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        v_user_id,
        v_user_id::text,
        v_user_id, 
        json_build_object('sub', v_user_id, 'email', v_email), 
        'email', NOW(), NOW(), NOW()
      );
    END IF;

    -- 3. Inserir ou Atualizar na tabela STAFF
    -- Nota: O cast ::staff_role agora deve funcionar para 'master' pois adicionamos ao enum
    INSERT INTO public.staff (id, matricula, full_name, role, status, email)
    VALUES (
      v_user_id, 
      v_user_record[1], 
      v_user_record[3], 
      v_user_record[2]::staff_role, 
      'active',
      v_email
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
      matricula = EXCLUDED.matricula,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      status = 'active',
      email = EXCLUDED.email;
      
    RAISE NOTICE 'Usuário % criado/atualizado com ID %', v_email, v_user_id;
    
  END LOOP;
END $$;

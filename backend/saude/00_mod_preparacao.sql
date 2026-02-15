-- MÓDULO 0: Preparação do Ambiente (SAÚDE)
-- Autor: Trae AI
-- Data: 2026-02-14
-- Descrição: Configuração inicial de extensões, tipos e funções base.

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- 2. Tipos ENUM (Baseados na documentação de Saúde)
DO $$ BEGIN
    CREATE TYPE professional_type AS ENUM ('doctor', 'nurse', 'rescuer', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE access_level AS ENUM ('basic', 'medium', 'advanced', 'full');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Função de Atualização de Timestamp (Trigger)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Funções de Verificação de Permissão (Helpers para RLS)
-- Verifica se o usuário atual é admin ou master na tabela staff
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = auth.uid() 
    AND role IN ('admin', 'master')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica se o usuário é do sistema (service_role)
CREATE OR REPLACE FUNCTION public.is_system()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica role do JWT ou se é superuser (opcional)
  RETURN (auth.jwt() ->> 'role') = 'service_role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper para Hash SHA256 (Wrapper para pgcrypto)
CREATE OR REPLACE FUNCTION public.sha256_text(text_to_hash TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(text_to_hash, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 6. Função de Bloqueio de Update/Delete (Imutabilidade)
CREATE OR REPLACE FUNCTION public.block_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Updates and deletions are not allowed on this table (Immutable Log).';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Helpers de Assert (Para RPCs)
CREATE OR REPLACE FUNCTION public.assert_authenticated()
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() AND NOT public.is_system() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;
END;
$$ LANGUAGE plpgsql;

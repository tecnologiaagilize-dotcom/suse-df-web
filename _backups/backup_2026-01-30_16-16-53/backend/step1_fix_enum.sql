-- Script separado para corrigir o ENUM 'staff_role'
-- Execute este script SOZINHO primeiro para garantir que o valor 'master' seja commitado.

DO $$
BEGIN
    ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'master';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Não coloque nada mais neste script para evitar o erro "unsafe use of new value"

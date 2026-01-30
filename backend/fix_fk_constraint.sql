-- CORREÇÃO DE DEPENDÊNCIA (FOREIGN KEY) PARA LIMPEZA DE USUÁRIOS
-- Resolve: "update or delete on table 'users' violates foreign key constraint"

-- 1. Remover dependências antes de limpar usuários
-- Apagar alertas de usuários que não existem mais no Auth (Cascade manual)
DELETE FROM public.location_updates 
WHERE alert_id IN (
    SELECT id FROM public.emergency_alerts 
    WHERE user_id NOT IN (SELECT id FROM auth.users)
);

DELETE FROM public.emergency_alerts 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2. Agora sim, limpar usuários órfãos
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- 3. (Opcional, mas recomendado) Configurar FK para CASCADE no futuro
-- Evita que isso aconteça novamente
ALTER TABLE public.emergency_alerts
DROP CONSTRAINT IF EXISTS emergency_alerts_user_id_fkey,
ADD CONSTRAINT emergency_alerts_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;

-- 4. Função do Trigger "À Prova de Falhas" (Reaplicar para garantir)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_phone TEXT;
BEGIN
  v_name := COALESCE(new.raw_user_meta_data->>'name', new.email);
  v_phone := NULLIF(new.raw_user_meta_data->>'phone_number', '');

  BEGIN
    INSERT INTO public.users (id, email, name, phone_number, created_at)
    VALUES (new.id, new.email, v_name, v_phone, NOW())
    ON CONFLICT (id) DO UPDATE SET email = excluded.email;
  EXCEPTION 
    WHEN OTHERS THEN
      RAISE WARNING 'Erro não-bloqueante ao criar perfil: %', SQLERRM;
  END;
  
  RETURN new;
END;
$$;

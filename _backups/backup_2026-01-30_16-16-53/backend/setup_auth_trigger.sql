-- Trigger para criar perfil público automaticamente ao registrar usuário
-- Evita discrepância entre Auth e Public.Users e garante que o usuário exista para o App

-- 1. Função que manipula o novo usuário
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name, phone_number, created_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.email), -- Tenta pegar nome do metadata ou usa email
    new.raw_user_meta_data->>'phone_number', -- Tenta pegar telefone do metadata
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(excluded.name, public.users.name); -- Atualiza se já existir (raro, mas seguro)
  return new;
end;
$$;

-- 2. Criar o Trigger
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

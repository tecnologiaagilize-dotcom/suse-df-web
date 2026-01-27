-- Sincronizar IDs da tabela STAFF com IDs do AUTH
-- Isso é crucial para que as permissões (RLS) funcionem, pois elas checam auth.uid() = id

UPDATE staff
SET id = au.id
FROM auth.users au
WHERE staff.email = au.email;

-- Verificar se funcionou (deve retornar os usuários com IDs iguais)
SELECT s.email, s.role, s.id as staff_id, au.id as auth_id
FROM staff s
JOIN auth.users au ON s.email = au.email;

# Configuração do Backend (Supabase)

Este projeto utiliza o Supabase como Backend-as-a-Service (BaaS), fornecendo Banco de Dados PostgreSQL, Autenticação e APIs em tempo real.

## Passo a Passo

1. **Criar Projeto**:
   - Acesse [database.new](https://database.new) e crie um novo projeto.

2. **Configurar Banco de Dados**:
   - Copie todo o código do arquivo [`schema.sql`](./schema.sql).
   - Cole no **SQL Editor** do seu projeto Supabase.
   - Clique em **Run**.

   Isso criará:
   - Tabelas: `users`, `staff`, `emergency_alerts`, `location_updates`, `share_links`.
   - Enums e Tipos personalizados.
   - Índices para performance.
   - Políticas de Segurança (RLS).

3. **Configurar Autenticação**:
   - No menu **Authentication > Providers**, habilite Email/Password ou Phone Auth conforme necessidade.

4. **Variáveis de Ambiente**:
   - Você precisará das chaves de API para configurar os clientes Web e Mobile.
   - Encontre em: **Project Settings > API**.

## Estrutura de Dados

- **users**: Motoristas/Usuários do app mobile.
- **staff**: Equipe de atendimento (Operadores, Chefes, Supervisores).
- **emergency_alerts**: Ocorrências de socorro ativas e históricas.
- **location_updates**: Rastro de localização em tempo real.

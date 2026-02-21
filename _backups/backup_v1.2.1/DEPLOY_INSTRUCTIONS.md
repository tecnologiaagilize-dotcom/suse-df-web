# Guia de Deploy - Veritas Orbiun

Para fazer o deploy do **Veritas Orbiun** na Vercel, siga estes passos, pois este repositório é um *monorepo* (contém múltiplos projetos).

## Passo 1: Criar Novo Projeto na Vercel

1. Acesse seu dashboard na [Vercel](https://vercel.com/dashboard).
2. Clique em **"Add New..."** -> **"Project"**.
3. Importe o repositório `suse-df-web` (ou o nome que estiver no seu GitHub).

## Passo 2: Configurar o Root Directory (CRUCIAL)

Na tela de configuração "Configure Project":

1. Procure a seção **"Root Directory"**.
2. Clique em **"Edit"**.
3. Selecione a pasta `apps/veritas-web`.
4. Isso fará com que a Vercel reconheça este projeto específico e use o `package.json` e `vercel.json` corretos.

## Passo 3: Variáveis de Ambiente

Na seção **"Environment Variables"**, adicione as chaves que estão no seu arquivo `.env`:

- `VITE_SUPABASE_URL`: `https://knuhnorzaxxbnwekmjxg.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: (Copie o valor longo do seu arquivo .env local)

## Passo 4: Deploy

Clique em **"Deploy"**.

---

### Solução de Problemas Comuns

- **Erro "Command not found" ou build falhando**: Verifique se você configurou o *Root Directory* corretamente no Passo 2. Se a Vercel tentar rodar o build da raiz, ela vai tentar buildar o projeto antigo (`apps/web`).
- **Tela Branca ou 404**: Certifique-se de que o `vercel.json` dentro de `apps/veritas-web` está configurado com as regras de rewrite (já configuramos isso no código).

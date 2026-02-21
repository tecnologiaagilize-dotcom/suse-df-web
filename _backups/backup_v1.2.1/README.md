# SUSE-DF - Sistema de Socorro Emergencial

Sistema de socorro emergencial composto por um aplicativo móvel para usuários (motoristas) e um painel web para atendentes, integrados via Supabase.

## 🚀 Tecnologias

- **Código Fonte & Versionamento**: [GitHub](https://github.com/)
- **Backend & Banco de Dados**: [Supabase](https://supabase.com/) (PostgreSQL + Realtime)
- **Hospedagem Web**: [Vercel](https://vercel.com/)
- **Frontend Web**: React + Vite + TailwindCSS
- **Mobile**: React Native

## 📂 Estrutura do Projeto

```
/
├── apps/
│   ├── web/          # Dashboard para Atendentes (React)
│   └── mobile/       # App para Usuários/Motoristas (React Native)
├── backend/
│   └── schema.sql    # Estrutura do Banco de Dados (SQL)
└── README.md
```

## 🛠️ Configuração do Ambiente

### 1. GitHub (Upload via Web)

Como você optou por utilizar o GitHub via interface Web:

1. Acesse [github.com/new](https://github.com/new) e crie um novo repositório (ex: `suse-df`).
2. Na tela inicial do repositório, clique em **"uploading an existing file"**.
3. Arraste as pastas `apps` e `backend` e o arquivo `README.md` para a área de upload.
   * *Nota: O GitHub Web pode ter limites para upload de pastas com muitos arquivos (como `node_modules`). Certifique-se de NÃO enviar a pasta `node_modules`.*
4. Adicione uma mensagem de commit (ex: "Estrutura inicial do projeto") e clique em **Commit changes**.

### 2. Supabase (Backend)

1. Crie um novo projeto no [Supabase](https://supabase.com/).
2. Vá até o **SQL Editor** no dashboard do Supabase.
3. Copie o conteúdo do arquivo [`backend/schema.sql`](./backend/schema.sql) e execute.
4. Vá em **Project Settings > API** e copie:
   - Project URL
   - anon / public key

### 3. Dashboard Web (Vercel)

1. Entre na pasta `apps/web`:
   ```bash
   cd apps/web
   npm install
   ```
2. Crie o arquivo `.env.local` baseado no `.env.example` e adicione suas chaves do Supabase.
3. Para rodar localmente:
   ```bash
   npm run dev
   ```
4. **Deploy na Vercel**:
   - Conecte seu repositório GitHub na Vercel.
   - Selecione o diretório `apps/web` como Root Directory.
   - Adicione as variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) no painel da Vercel.

### 4. Mobile App

1. Entre na pasta `apps/mobile`:
   ```bash
   cd apps/mobile
   npm install
   ```
2. Configure o ambiente React Native (Android/iOS).
3. Execute:
   ```bash
   npm run android
   # ou
   npm run ios
   ```

## 👥 Perfis de Usuário

- **Usuário (Motorista)**: Acesso via App Mobile. Botão de Pânico e Palavra Secreta.
- **Operador de Mesa**: Acesso Web. Visualiza alertas e mapas.
- **Chefe de Atendimento**: Acesso Web. Gestão de operadores e ocorrências complexas.
- **Supervisor do Sistema**: Acesso Web. Administração global.

## 🔒 Segurança

- Autenticação gerenciada pelo Supabase Auth.
- Dados protegidos por Row Level Security (RLS).
- Comunicação criptografada.

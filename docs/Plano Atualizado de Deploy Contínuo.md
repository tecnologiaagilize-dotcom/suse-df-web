# Plano Atualizado de Deploy Contínuo (GitHub + Vercel)

Como o repositório já está conectado e o deploy inicial foi feito, o processo agora é muito mais simples e automatizado.

## 1. Fluxo de Trabalho de Atualização
Sempre que você pedir alterações no código, seguiremos este ciclo:

1.  **Desenvolvimento Local:** Eu faço as alterações nos arquivos aqui no seu computador.
2.  **Commit & Push:** Eu uso os comandos `git add`, `git commit` e `git push` para enviar as mudanças para o GitHub.
3.  **Deploy Automático:** A Vercel detecta automaticamente a mudança no GitHub e inicia a atualização do site.

## 2. Status Atual
*   **Repositório GitHub:** `https://github.com/tecnologiaagilize-dotcom/suse-df-web.git` (Conectado e Atualizado)
*   **Vercel:** Já está configurada para monitorar o branch `master` deste repositório.
*   **Última Ação:** Acabamos de enviar o modal de relatórios. A Vercel provavelmente já está processando ou finalizou essa atualização.

## 3. Próximos Passos (Manutenção)
Para manter tudo funcionando, você só precisa garantir que:

*   **Banco de Dados (Supabase):** Se eu criar novos scripts SQL (como fiz com o `mod_relatorios.sql`), você precisa executá-los manualmente no painel do Supabase, pois o deploy do código não altera o banco de dados automaticamente.
*   **Variáveis de Ambiente:** Se criarmos novas chaves no futuro, elas precisarão ser adicionadas tanto no `.env.local` (aqui) quanto no painel da Vercel.

**Resumo:** O sistema de "Integração Contínua" já está funcionando. Basta eu continuar enviando o código (Push) e a Vercel cuida do resto.
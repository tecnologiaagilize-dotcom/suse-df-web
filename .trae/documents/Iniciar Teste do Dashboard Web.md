Sim, podemos testar o **Dashboard Web (Visão do Atendente)** agora mesmo!

Como o aplicativo móvel requer um emulador (Android/iOS) ou um dispositivo físico conectado, focaremos em validar a parte Web, que é onde os atendentes receberão os alertas.

## Plano de Teste Local

### 1. Preparação do Ambiente Web
- Instalar as dependências do projeto Web (`npm install`).
- Verificar se as variáveis de ambiente do Supabase estão configuradas corretamente.

### 2. Execução
- Iniciar o servidor de desenvolvimento local (`npm run dev`).
- Gerar um link de visualização (localhost).

### 3. O que você poderá testar
- **Tela de Login**: Validar a autenticação com o Supabase.
- **Dashboard Principal**: Ver a lista de alertas em tempo real.
- **Responsividade**: Verificar como o layout se comporta.

*Nota: Se o seu terminal apresentar restrições de permissão para rodar o npm, tentaremos contornar ou solicitarei uma permissão manual.*

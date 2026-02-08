# Release Notes - V1.2.6

**Data:** 08/02/2026
**Versão:** V1.2.6
**Status:** Produção / Estável

## 🚀 Novas Funcionalidades e Melhorias

### 1. Central de Monitoramento (AdminDashboard)
- **Integração de Geolocalização na Validação:**
  - O modal de validação de encerramento (`ValidationModal`) agora exibe o mapa de rastreamento em tempo real ao lado da evidência visual (foto).
  - Implementada funcionalidade de **"AMPLIAR MAPA"** (Expand Map), permitindo visualizar a localização em tela cheia/overlay durante a validação.
  - O mapa de fundo do dashboard é automaticamente ocultado/minimizado quando o modal está aberto para evitar sobreposição e conflitos de renderização.

### 2. Melhorias de Usabilidade (UX/UI)
- **Máscara de Telefone:**
  - O campo de telefone do oficial no modal de validação agora aplica automaticamente a máscara `(DD) XXXXX-XXXX` para padronização.
- **Colagem de Token:**
  - Adicionado botão **"COLAR"** (Paste) ao lado do campo de Token de Segurança, facilitando a inserção rápida a partir da área de transferência.

### 3. Sistema
- **Atualização de Versão:**
  - Todos os cabeçalhos de sistema (Admin, Driver, Login) atualizados para exibir a versão **V1.2.6**.
  - `package.json` atualizado para refletir a versão atual.

## 🛠️ Detalhes Técnicos
- Refatoração do `ValidationModal.jsx` para suportar layout responsivo com mapa e foto lado a lado.
- Uso de `navigator.clipboard.readText()` para a funcionalidade de colar.
- Ajustes de CSS (Tailwind) para transições suaves na expansão do mapa.
- Passagem de props `currentLat` e `currentLng` do Dashboard para o Modal para garantir precisão na localização exibida.

## 📦 Arquivos Modificados
- `apps/web/src/components/modals/ValidationModal.jsx`
- `apps/web/src/pages/AdminDashboard.jsx`
- `apps/web/src/pages/driver/Dashboard.jsx`
- `apps/web/src/pages/Login.jsx`
- `apps/web/src/pages/driver/Login.jsx`
- `apps/web/package.json`

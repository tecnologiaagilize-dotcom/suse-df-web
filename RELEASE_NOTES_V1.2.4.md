# Notas de Lançamento - Versão V1.2.4

**Data:** 08/02/2026
**Status:** Produção / Estável

## 🚀 Novas Funcionalidades e Melhorias

### 1. Alerta Sonoro na Central de Monitoramento
- **Funcionalidade:** Implementado sistema de áudio (sirene) que toca automaticamente no Dashboard Administrativo.
- **Comportamento:** O som é acionado sempre que uma nova ocorrência com status `active` (Em Ocorrência) é detectada e não estava presente na lista anterior.
- **Objetivo:** Garantir que os operadores percebam novas emergências mesmo se não estiverem olhando diretamente para a tela.

### 2. Modal de Histórico de Ocorrências (Somente Leitura)
- **Funcionalidade:** Novo modal `ResolvedAlertModal` para visualizar detalhes de ocorrências já finalizadas.
- **Acesso:** Disponível ao clicar no botão "FINALIZADO" (Azul) na lista de alertas.
- **Conteúdo Exibido:**
    - Timestamps (Início, Atendimento, Encerramento).
    - Dados completos do motorista e veículo.
    - Evidência de encerramento (Foto e Justificativa).
    - Localização final no mapa estático.

### 3. Atualizações de Interface (UI/UX)
- **Identificação de Versão:**
    - Adicionado indicador `v1.2.4` nas telas de Login (Condutor e Administrativo).
    - Mantido indicador no Header dos Dashboards.
- **Padronização de Status (Admin):**
    - Status internos `active` e `investigating` agora são exibidos unificadamente como **"EM OCORRÊNCIA"**.
    - Status `resolved` exibido como **"RESOLVIDO"**.
- **Sinalização de Urgência:**
    - A etiqueta de status "EM OCORRÊNCIA" mantém o estilo **Vermelho e Pulsante** durante todo o ciclo de vida ativo da ocorrência, reforçando a atenção necessária.
    - O botão de ação na lista, mesmo após a ocorrência ser assumida, agora exibe **"EM OCORRÊNCIA"** (Vermelho/Pulse) em vez de "Em Atendimento" (Azul), para evitar falsa sensação de normalidade.
- **Detalhamento de Finalização:**
    - O botão de ocorrências resolvidas agora distingue a origem do encerramento:
        - **"FINALIZADO OPERADOR"**: Encerramento administrativo pela central.
        - **"FINALIZADO CONDUTOR"**: Encerramento via app do motorista (com token).

## 🛠️ Alterações Técnicas
- **Arquivos Modificados:**
    - `apps/web/src/pages/AdminDashboard.jsx`: Lógica de áudio, novas colunas de status, integração com modais.
    - `apps/web/src/pages/driver/Dashboard.jsx`: Atualização da label de versão.
    - `apps/web/src/pages/Login.jsx` & `apps/web/src/pages/driver/Login.jsx`: Inclusão da versão v1.2.4.
    - `apps/web/src/components/modals/ResolvedAlertModal.jsx`: Novo componente.

---
*Este documento acompanha o backup `backup_v1.2.4_complete.zip`.*

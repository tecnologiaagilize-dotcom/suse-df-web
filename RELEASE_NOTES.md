# Release Notes - v3.33 (Blue Theme & Audio Live)

## 🎨 Nova Identidade Visual (Blue Theme) & Audio Live

Esta versão unifica a identidade visual de todos os painéis (Condutor, Passageiro, Profissional) com o novo tema Azul (#00509d) e introduz o streaming de áudio em tempo real para emergências.

### Alterações Principais:

#### 1. Identidade Visual Unificada (Blue Theme)
*   **Cabeçalho e Rodapé Padronizados**: Todos os painéis agora utilizam a cor `#00509d` para reforçar a identidade da marca SUSE-DF.
*   **Animações Interativas**: Novos ícones animados nos botões de ação rápida:
    *   📍 **Cerca Virtual**: Pin com movimento aleatório (`jitter`).
    *   👤 **Meu Cadastro**: Rosto com olhos e boca animados.
    *   🎙️ **Configurar Voz**: Onda sonora (`wave`).
    *   ❤️ **Minha Saúde**: Batimento cardíaco (`heartbeat`).

#### 2. Audio Live (Streaming de Emergência)
*   **Transmissão em Tempo Real**: O áudio do ambiente é transmitido para a central de monitoramento assim que uma emergência é ativada.
*   **Black Box Local**: Gravação local de backup para garantir evidências mesmo em caso de falha de rede.

#### 3. Melhorias de UX
*   **Botão SOS Reposicionado**: Agora localizado estrategicamente abaixo das instruções de emergência.
*   **Feedback de Voz**: Visualização de transcrição aprimorada no painel do passageiro.

### Versões dos Componentes:
*   **App Web**: v3.33
*   **IRA-SUSI Engine**: v2.0

---

# Release Notes - v1.3.7 (Map Expansion & Strict IRA v1.2)

## 🗺️ Geolocalização Expandida & IRA-SUSI v1.2

Esta versão foca na melhoria da consciência situacional (mapa visível no card de localização) e na atualização do motor de risco acústico para a versão v1.2.

### Alterações Principais:

#### 1. Card de Localização (Dashboard Condutor/Passageiro)
*   **Mapa Integrado**: O card de "Localização Atual" agora exibe um mapa interativo (altura reduzida: ~128px) em vez de apenas coordenadas de texto.
*   **Compartilhamento**: Novo botão para compartilhar a localização em tempo real via WhatsApp ou copiar link.
*   **Layout Compacto**: Altura ajustada para otimizar o espaço em tela.

#### 2. IRA-SUSI v1.2 (Strict Compliance)
*   **Status Visual**: Adicionado indicador "MIC ON" (ponto verde pulsante) no cabeçalho do card de status para confirmar funcionamento do microfone.
*   **Versão Atualizada**: O motor de análise de risco foi atualizado para v1.2, mantendo o modo estrito de detecção (Zero Falso Positivo).
*   **Regras de Acionamento**: Refinamento nos thresholds de impacto e grito.

### Versões dos Componentes:
*   **App Web**: v1.3.7
*   **IRA-SUSI Engine**: v1.2 (Strict Mode)

---

# Release Notes - v1.3.5 (Interface Gauge v3.0)

## 📊 Nova Interface de Monitoramento

Esta versão introduz o **Monitoramento Estilo Gauge (Agulha)** para o IRA-SUSI, facilitando a leitura rápida dos níveis de risco.

### Alterações Principais:

#### 1. Interface de Monitoramento (Gauge Linear)
*   **Fundo Segmentado**: A barra de risco agora é fixa e dividida em 3 zonas de cor:
    *   🟩 **Seguro (0-40%)**: Zona Verde.
    *   🟨 **Atenção (40-75%)**: Zona Amarela.
    *   🟥 **Risco Crítico (75-100%)**: Zona Vermelha.
*   **Indicador Móvel**: Uma agulha (marcador branco) se move sobre as zonas coloridas indicando o nível exato de stress acústico em tempo real.

#### 2. Protocolo de Impacto (Reforço)
*   Implementada priorização de **WhatsApp** em caso de colisão detectada.
*   Log de auditoria explícito para eventos de impacto.

### Versões dos Componentes:
*   **App Web**: v1.3.5
*   **IRA-SUSI Engine**: v1.1-official (Strict Mode)

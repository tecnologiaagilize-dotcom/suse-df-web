# Release Notes - v1.3.40 (Unified Stream Architecture)

## 🎙️ Estabilidade de Áudio & Stream Unificado

Esta versão implementa a **Unified Stream Architecture** para resolver definitivamente os conflitos de microfone em dispositivos móveis e navegadores restritivos (como Chrome no Android).

### Alterações Principais:

#### 1. Stream de Áudio Compartilhado (Shared Stream)
*   **Problema Resolvido**: Anteriormente, o sistema de VAD (Detecção de Voz) e o sistema de Análise (Meyda/Worklet) tentavam abrir dois canais de microfone separados. Em muitos dispositivos, o segundo pedido falhava ou matava o primeiro, tornando o status IRA "inoperante".
*   **Solução**: O `VoiceEmergencyListener` agora captura o áudio uma única vez e "empresta" esse fluxo para todos os serviços (VAD, Streaming, Análise).

#### 2. VAD Nativo com Injeção de Dependência
*   O serviço `VoiceActivityService` foi refatorado para aceitar um `MediaStream` externo, evitando que ele tente sequestrar o hardware de áudio.

### Versões dos Componentes:
*   **App Web**: v1.3.40
*   **IRA-SUSI Engine**: v1.3.1 (Unified Stream)

---

# Release Notes - v1.3.39 (Audio Core Optimization & Compliance)

## 🎙️ Otimização do Núcleo de Áudio & Compliance Técnico

Esta versão foca na estabilização da captura de voz e na precisão da análise semântica, atendendo aos requisitos dos cadernos técnicos `audiov1.3.39` e `audiocomplv1.3.39`.

### Alterações Principais:

#### 1. Qualidade de Áudio (48kHz)
*   **High Fidelity Capture**: A taxa de amostragem foi elevada de 16kHz para **48kHz** (padrão Opus/WebRTC). Isso melhora significativamente a clareza para a transcrição e a precisão da análise biométrica.

#### 2. Análise Semântica "Sliding Window"
*   **Correção de Match**: Implementada lógica de **Janela Deslizante (Sliding Window)** que analisa as últimas 20 palavras faladas em busca da frase de emergência.
*   **Benefício**: Resolve o problema onde a frase não era detectada se o usuário falasse algo *após* a senha (ex: "Socorro agora por favor"). Antes, o sistema olhava apenas o final exato.

#### 3. VAD Nativo Calibrado
*   **Redução de Falsos Positivos**: O limiar de detecção de voz (Energy Threshold) foi aumentado de 25 para **45**.
*   **Estabilidade**: O tempo de espera para considerar "fim da fala" (debounce) subiu de 800ms para **1.5s**, evitando que o sistema corte o áudio durante pausas naturais na respiração.

### Versões dos Componentes:
*   **App Web**: v1.3.39
*   **IRA-SUSI Engine**: v1.3 (Sliding Window Logic)

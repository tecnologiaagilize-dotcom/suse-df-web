# Estrutura de Aprimoramento da Captação de Áudio (SUSI)

**Referência:** Análise do módulo de voz atual e planejamento para sistema crítico de monitoramento.
**Status:** Planejamento Técnico
**Data:** 14/02/2026

---

## 1. Diagnóstico da Implementação Atual

Atualmente, o sistema utiliza o componente `VoiceEmergencyListener.jsx` rodando na thread principal do React.

### Pontos Fortes Identificados:
*   ✅ **Rolling Buffer (Conceitual):** O sistema já mantém um array de `chunks` e descarta os antigos a cada 2 segundos.
*   ✅ **Web Speech API:** Utiliza a API nativa do navegador para transcrição (STT).
*   ✅ **Fallback de Reinício:** Possui lógica para reiniciar o `SpeechRecognition` se ele parar (o que é comum na API nativa).

### Limitações para "Sistema Crítico":
1.  **Bloqueio da UI:** O processamento de áudio concorre com a renderização da interface. Se o app travar visualmente, o áudio pode falhar.
2.  **Dependência de Rede:** A `Web Speech API` (Chrome) envia áudio para o Google para transcrever. Sem internet, o acionamento por voz falha.
3.  **Gerenciamento de Memória:** O buffer é um array de objetos `Blob/ArrayBuffer` que cresce dinamicamente. O Garbage Collector (GC) pode causar "soluços" no áudio ao limpar chunks antigos.
4.  **Latência:** O `MediaRecorder` grava em chunks de 200ms, o que é bom, mas para análise em tempo real (DSP), precisamos de acesso aos dados brutos (PCM) via `AudioContext`.

---

## 2. Arquitetura Proposta: "Audio Core v2"

Para elevar o nível para "Monitoramento Contínuo Crítico", propomos migrar a lógica de captação para fora da thread principal.

### 🏗️ Nova Stack Tecnológica

| Componente | Tecnologia Atual | Tecnologia Proposta | Benefício |
| :--- | :--- | :--- | :--- |
| **Processamento** | Main Thread (React) | **AudioWorklet** + **Web Worker** | Zero travamento de UI, processamento em tempo real (128 samples/frame). |
| **Wake Word** | Web Speech API (Online) | **TensorFlow.js** (Local) ou **Vosk-browser** | Funciona **OFFLINE**, latência zero, maior privacidade. |
| **Buffer** | Array de Chunks | **Ring Buffer (SharedArrayBuffer)** | Memória fixa, sem GC, acesso instantâneo ao passado (pre-roll). |
| **Detecção de Voz** | Nenhuma (Grava tudo) | **VAD (Voice Activity Detection)** | Só processa/grava quando há fala humana. Economiza bateria/CPU. |

---

## 3. Detalhamento da Implementação

### Fase 1: Otimização do Buffer (Ring Buffer)
Em vez de `audioChunks.push()`, usaremos um `Float32Array` circular de tamanho fixo (ex: 30 segundos @ 16kHz = ~1MB de RAM).

```javascript
// Exemplo Conceitual do AudioWorklet
class EmergencyBufferProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    if (input.length > 0) {
      // Escreve no SharedArrayBuffer circular
      this.writeToBuffer(input[0]);
    }
    return true;
  }
}
```

### Fase 2: Detecção de Palavra-Chave Local (Wake Word)
Substituir ou complementar a `Web Speech API` por um modelo leve treinado para detectar apenas a palavra "SOCORRO" ou "AJUDA".

*   **Lib Sugerida:** `@tensorflow-models/speech-commands`
*   **Vantagem:** O áudio nunca sai do dispositivo a menos que a palavra seja detectada.
*   **Privacidade:** Compliance total com LGPD, pois não há "escuta" na nuvem constante.

### Fase 3: Detecção de Atividade de Voz (VAD)
Implementar um módulo VAD (ex: `onnxruntime-web` com Silero VAD) antes do reconhecedor.

1.  **Audio Input** -> **VAD** (É voz?)
2.  **Sim** -> Envia para Buffer Circular + Reconhecedor.
3.  **Não** -> Descarta (Ruído/Silêncio).

---

## 4. Fluxo de Dados Crítico

```mermaid
graph TD
    Mic[Microfone] -->|Stream PCM| Worklet[AudioWorklet (Thread Separada)]
    
    subgraph "Audio Core (Worker)"
        Worklet -->|Raw Audio| RingBuf[Ring Buffer (30s memória fixa)]
        Worklet -->|Raw Audio| VAD[Detector de Voz]
        
        VAD -->|Voz Detectada?| WakeWord[IA Local (TensorFlow)]
        
        WakeWord -->|Palavra 'SOCORRO'?| Trigger[Acionador de Emergência]
    end
    
    Trigger -->|1. Envia Buffer Passado| Cloud[Servidor SUSI]
    Trigger -->|2. Abre WebSocket| LiveStream[Streaming Ao Vivo]
    Trigger -->|3. Notifica| UI[Interface React]
```

## 5. Próximos Passos (Action Plan)

1.  [ ] **POC AudioWorklet:** Criar um processador simples que substitua o `MediaRecorder` para capturar áudio bruto sem travar a UI.
2.  [ ] **Implementar Ring Buffer:** Criar classe utilitária para gerenciar memória circular.
3.  [ ] **Integrar VAD:** Adicionar biblioteca leve de detecção de silêncio para evitar processamento inútil.
4.  [ ] **Refatorar `VoiceEmergencyListener`:** Transformá-lo apenas em um "controlador" que inicia/para os Workers, sem lógica pesada.

---

**Nota:** Esta estrutura visa resolver o problema de "Acesso Negado/Falha de Rede" ao garantir que a detecção inicial seja 100% local e offline-first.

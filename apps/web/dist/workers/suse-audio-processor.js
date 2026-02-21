// suse-audio-processor.js
// AudioWorkletProcessor para o sistema SUSI (Monitoramento Crítico)
// Executa fora da thread principal para garantir estabilidade na captação.

class SuseAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 128; // Padrão do AudioWorklet
    this._isActive = true;
  }

  process(inputs, outputs, parameters) {
    if (!this._isActive) return true;

    // input[0] é o primeiro input, input[0][0] é o primeiro canal (mono/left)
    const input = inputs[0];
    
    // Se houver áudio entrando
    if (input && input.length > 0) {
      const channelData = input[0];
      
      // Envia os dados brutos (Float32Array) para a thread principal
      // Em uma implementação completa (Passo 2), escreveremos direto no SharedArrayBuffer
      // Por enquanto (POC), usamos postMessage para validar o fluxo.
      this.port.postMessage({
        eventType: 'audio_data',
        audioBuffer: channelData
      });
    }

    return true; // Mantém o processador vivo
  }
}

registerProcessor('suse-audio-processor', SuseAudioProcessor);

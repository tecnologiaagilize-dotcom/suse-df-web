// suse-audio-processor.js
// AudioWorkletProcessor para o sistema SUSI (Monitoramento Crítico)
// Executa fora da thread principal para garantir estabilidade na captação.

class SuseAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 4096; // Acumular mais dados para processar em blocos maiores
    this._buffer = new Float32Array(this._bufferSize);
    this._bufferIndex = 0;
    this._isActive = true;
  }

  process(inputs, outputs, parameters) {
    if (!this._isActive) return true;

    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      
      // Acumular dados no buffer interno
      for (let i = 0; i < channelData.length; i++) {
        this._buffer[this._bufferIndex++] = channelData[i];
        
        // Quando buffer encher, envia para Main Thread
        if (this._bufferIndex >= this._bufferSize) {
          this.port.postMessage({
            eventType: 'audio_data',
            audioBuffer: this._buffer.slice() // Envia cópia
          });
          this._bufferIndex = 0; // Reset
        }
      }
    }

    return true;
  }
}

registerProcessor('suse-audio-processor', SuseAudioProcessor);

// public/workers/suse-audio-processor.js
// AudioWorklet Processor para RingBuffer sem SharedArrayBuffer

class SuseAudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (!input || input.length === 0) return true;

        const inputChannel = input[0]; // Processar apenas canal mono (0)

        // Copiar dados para buffer interno
        for (let i = 0; i < inputChannel.length; i++) {
            this.buffer[this.bufferIndex++] = inputChannel[i];

            // Quando buffer encher, enviar para main thread
            if (this.bufferIndex >= this.bufferSize) {
                this.port.postMessage(this.buffer.slice()); // Envia cópia
                this.bufferIndex = 0;
            }
        }

        return true; // Manter processador vivo
    }
}

registerProcessor('suse-audio-processor', SuseAudioProcessor);

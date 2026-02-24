/**
 * RingBufferService - Gerenciador de Memória Circular para Áudio
 * Permite escrita e leitura contínua de streams de áudio sem alocação dinâmica de memória.
 */
class RingBufferService {
    constructor(durationSeconds = 30, sampleRate = 16000) {
        this.sampleRate = sampleRate;
        this.capacity = durationSeconds * sampleRate;
        
        // Aloca SharedArrayBuffer se suportado (para AudioWorklet), senão ArrayBuffer normal
        try {
            this.buffer = new SharedArrayBuffer(this.capacity * 4); // Float32 = 4 bytes
        } catch (e) {
            console.warn("SharedArrayBuffer não suportado, usando ArrayBuffer (fallback).");
            this.buffer = new ArrayBuffer(this.capacity * 4);
        }
        
        this.view = new Float32Array(this.buffer);
        this.writePointer = 0;
    }

    /**
     * Escreve novos dados no buffer circular
     * @param {Float32Array} data - Chunk de áudio recebido
     */
    write(data) {
        const len = data.length;
        
        // Se o dado for maior que o buffer inteiro (improvável), escrevemos apenas o final
        if (len > this.capacity) {
            data = data.subarray(len - this.capacity);
        }

        // Primeira parte: Do ponteiro até o fim do buffer
        const endSpace = this.capacity - this.writePointer;
        
        if (len <= endSpace) {
            this.view.set(data, this.writePointer);
            this.writePointer += len;
        } else {
            // Divide em duas partes: Até o fim e o resto no início (wrap around)
            this.view.set(data.subarray(0, endSpace), this.writePointer);
            this.view.set(data.subarray(endSpace), 0);
            this.writePointer = len - endSpace;
        }

        if (this.writePointer >= this.capacity) {
            this.writePointer = 0;
        }
    }

    /**
     * Recupera os últimos N segundos de áudio
     * @param {number} seconds - Duração a recuperar
     * @returns {Float32Array} - Buffer linearizado
     */
    readLastSeconds(seconds) {
        const samplesToRead = Math.min(seconds * this.sampleRate, this.capacity);
        const result = new Float32Array(samplesToRead);
        
        // Calcula ponteiro de leitura retroativo
        let readPointer = this.writePointer - samplesToRead;
        
        if (readPointer >= 0) {
            // Leitura contínua sem wrap
            result.set(this.view.subarray(readPointer, this.writePointer));
        } else {
            // Leitura com wrap (final do buffer + início)
            const endPart = this.view.subarray(this.capacity + readPointer); // readPointer é negativo aqui
            const startPart = this.view.subarray(0, this.writePointer);
            
            result.set(endPart);
            result.set(startPart, endPart.length);
        }
        
        return result;
    }

    /**
     * Converte o buffer atual para WAV Blob (para download/upload)
     */
    getWavBlob(seconds = 10) {
        const audioData = this.readLastSeconds(seconds);
        return this.encodeWAV(audioData);
    }

    // Utilitário simples para criar cabeçalho WAV
    encodeWAV(samples) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, this.sampleRate, true);
        view.setUint32(28, this.sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        const floatTo16BitPCM = (output, offset, input) => {
            for (let i = 0; i < input.length; i++, offset += 2) {
                const s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        };

        floatTo16BitPCM(view, 44, samples);

        return new Blob([view], { type: 'audio/wav' });
    }
}

export default new RingBufferService();

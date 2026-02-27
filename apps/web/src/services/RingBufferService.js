/**
 * RingBufferService - Gerenciador de Memória Circular para Áudio
 * Permite escrita e leitura contínua de streams de áudio sem alocação dinâmica de memória.
 */
class RingBufferService {
    constructor(durationSeconds = 60, sampleRate = 16000) { // Aumentado para 60s
        this.sampleRate = sampleRate;
        this.capacity = durationSeconds * sampleRate;
        this.buffer = new Float32Array(this.capacity); // Simplificado para Float32Array direto
        this.writePointer = 0;
        this.isInitialized = true;
        console.log(`[RingBuffer] Inicializado com ${durationSeconds}s de capacidade.`);
    }

    /**
     * Reseta o buffer (limpa memória e ponteiros)
     */
    clear() {
        this.buffer.fill(0);
        this.writePointer = 0;
        console.log("[RingBuffer] Memória limpa e reiniciada.");
    }

    /**
     * Escreve novos dados no buffer circular
     * @param {Float32Array} data - Chunk de áudio recebido
     */
    write(data) {
        if (!data || data.length === 0) return;
        
        const len = data.length;
        let readIdx = 0;

        // Escrita circular otimizada
        while (readIdx < len) {
            const spaceToEnd = this.capacity - this.writePointer;
            const chunk = Math.min(len - readIdx, spaceToEnd);
            
            this.buffer.set(data.subarray(readIdx, readIdx + chunk), this.writePointer);
            
            this.writePointer = (this.writePointer + chunk) % this.capacity;
            readIdx += chunk;
        }
    }

    /**
     * Recupera os últimos N segundos de áudio
     * @param {number} seconds - Duração a recuperar
     * @returns {Float32Array} - Buffer linearizado
     */
    readLastSeconds(seconds) {
        const samplesNeeded = Math.min(seconds * this.sampleRate, this.capacity);
        const result = new Float32Array(samplesNeeded);
        
        let readPtr = this.writePointer - samplesNeeded;
        if (readPtr < 0) readPtr += this.capacity;
        
        // Copia em duas partes (se necessário) para lidar com o wrap-around
        if (readPtr + samplesNeeded <= this.capacity) {
            result.set(this.buffer.subarray(readPtr, readPtr + samplesNeeded));
        } else {
            const firstPartLen = this.capacity - readPtr;
            result.set(this.buffer.subarray(readPtr, this.capacity), 0);
            result.set(this.buffer.subarray(0, samplesNeeded - firstPartLen), firstPartLen);
        }
        
        return result;
    }

    /**
     * Converte o buffer atual para WAV Blob
     */
    getWavBlob(seconds = 5) { // Default 5s
        const audioData = this.readLastSeconds(seconds);
        
        // Verifica se há silêncio absoluto (buffer zerado ou não gravado)
        let hasSignal = false;
        for(let i=0; i<audioData.length; i+=100) { // Amostragem rápida
            if (Math.abs(audioData[i]) > 0.001) {
                hasSignal = true; 
                break;
            }
        }
        
        if (!hasSignal) {
            console.warn("[RingBuffer] Buffer vazio ou silêncio detectado ao gerar Blob.");
            // Retorna Blob vazio propositalmente para falhar no check de tamanho
            return new Blob([], { type: 'audio/wav' }); 
        }

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

        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, samples[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }
}

// Singleton Instance
const ringBufferInstance = new RingBufferService();
export default ringBufferInstance;

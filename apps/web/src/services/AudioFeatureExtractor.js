import Meyda from 'meyda';

/**
 * AudioFeatureExtractor - Módulo DSP para o SUSI
 * Responsável por extrair características acústicas do sinal de áudio em tempo real.
 */
class AudioFeatureExtractor {
    constructor() {
        this.bufferSize = 2048; // Aumentado para melhor resolução de frequência (necessário para Pitch/HNR)
        this.sampleRate = 16000; // Taxa de amostragem padrão do SUSI
        this.meydaAnalyzer = null;
        
        // Buffers para cálculo de Jitter/Shimmer (Janela de 10 frames ~ 0.5s)
        this.historySize = 10;
        this.rmsHistory = new Float32Array(this.historySize);
        this.centroidHistory = new Float32Array(this.historySize);
        this.historyIndex = 0;
    }

    /**
     * Inicializa o analisador Meyda com o contexto de áudio
     * @param {AudioContext} audioContext 
     * @param {AudioNode} sourceNode 
     */
    initialize(audioContext, sourceNode) {
        if (this.meydaAnalyzer) return;

        if (!audioContext || audioContext.state === 'closed') {
            console.warn("AudioFeatureExtractor: Tentativa de iniciar com AudioContext fechado ou inválido.");
            return;
        }

        this.sampleRate = audioContext.sampleRate;

        try {
            this.meydaAnalyzer = Meyda.createMeydaAnalyzer({
                audioContext: audioContext,
                source: sourceNode,
                bufferSize: this.bufferSize,
                featureExtractors: [
                    'rms',              // Energia (Volume)
                    'zcr',              // Taxa de Cruzamento por Zero
                    'spectralCentroid', // Brilho (Proxy de Pitch)
                    'spectralFlatness', // Tonalidade (Inverso de HNR)
                    'energy',           // Energia total
                    'loudness',         // Percepção de volume (ISO 532-1)
                    'perceptualSpread', // Largura de banda percebida
                    'spectralRolloff'   // Frequência de corte (95% energia)
                ],
                callback: (features) => {
                    // Callback opcional
                }
            });
            this.meydaAnalyzer.start();
            console.log("AudioFeatureExtractor: DSP Iniciado com Meyda (Extended Features)");
        } catch (err) {
            console.error("AudioFeatureExtractor: Erro ao iniciar Meyda", err);
        }
    }

    /**
     * Calcula desvio padrão relativo (Coeficiente de Variação)
     */
    calculateCV(buffer) {
        let sum = 0;
        for(let i=0; i<buffer.length; i++) sum += buffer[i];
        const mean = sum / buffer.length;
        if (mean === 0) return 0;

        let sqDiffSum = 0;
        for(let i=0; i<buffer.length; i++) sqDiffSum += Math.pow(buffer[i] - mean, 2);
        const stdDev = Math.sqrt(sqDiffSum / buffer.length);
        
        return stdDev / mean;
    }

    /**
     * Obtém as features do frame atual
     * @returns {Object|null} Features acústicas ou null se não inicializado
     */
    getFeatures() {
        if (!this.meydaAnalyzer) return null;
        
        const features = this.meydaAnalyzer.get([
            'rms', 
            'zcr', 
            'spectralCentroid', 
            'spectralFlatness',
            'energy',
            'loudness',
            'perceptualSpread',
            'spectralRolloff'
        ]);

        if (!features) return null;

        // Atualizar histórico para Jitter/Shimmer
        this.rmsHistory[this.historyIndex] = features.rms;
        this.centroidHistory[this.historyIndex] = features.spectralCentroid;
        this.historyIndex = (this.historyIndex + 1) % this.historySize;

        // Calcular proxies
        const shimmerProxy = this.calculateCV(this.rmsHistory); // Variação de amplitude
        const jitterProxy = this.calculateCV(this.centroidHistory); // Variação de frequência (centroid)
        
        // HNR Proxy: Inverso do Flatness (Flatness 1.0 = Ruído puro, 0.0 = Tom puro)
        // HNR ~ (1 - Flatness) * 20 (escala arbitrária 0-20dB)
        const hnrProxy = (1 - features.spectralFlatness) * 20;

        // Conversão RMS Linear [0, 1] para dBFS [-120, 0]
        // dBFS = 20 * log10(rms)
        const dbfs = features.rms > 0.000001 ? 20 * Math.log10(features.rms) : -120;

        return {
            rms: features.rms,
            dbfs: dbfs, // Adicionado campo dBFS
            zcr: features.zcr,
            spectralCentroid: features.spectralCentroid,
            spectralFlatness: features.spectralFlatness,
            energy: features.energy,
            loudness: features.loudness ? features.loudness.total : 0,
            
            // Features Sintetizadas para IRA-SUSI
            pitch: features.spectralCentroid, // Proxy de F0
            shimmer: shimmerProxy * 100, // Converter para % (0.03 -> 3%) - Ajuste de escala
            jitter: jitterProxy * 100, // Converter para %
            hnr: hnrProxy,

            timestamp: Date.now()
        };
    }

    stop() {
        if (this.meydaAnalyzer) {
            this.meydaAnalyzer.stop();
            this.meydaAnalyzer = null;
        }
    }
}

export default new AudioFeatureExtractor();

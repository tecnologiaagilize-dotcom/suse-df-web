import Meyda from 'meyda';

/**
 * AudioFeatureExtractor - Módulo DSP para o SUSI
 * Responsável por extrair características acústicas do sinal de áudio em tempo real.
 */
class AudioFeatureExtractor {
    constructor() {
        this.bufferSize = 512; // Tamanho do frame para análise (potência de 2)
        this.sampleRate = 16000; // Taxa de amostragem padrão do SUSI
        this.meydaAnalyzer = null;
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
                    'zcr',              // Taxa de Cruzamento por Zero (Ruído vs Tom)
                    'spectralCentroid', // Brilho (Gritos são agudos)
                    'spectralFlatness', // Tonalidade (Grito é tonal, Vento é flat)
                    'energy'            // Energia total
                ],
                callback: (features) => {
                    // Callback opcional, preferimos pull manual via getFeatures()
                }
            });
            this.meydaAnalyzer.start();
            console.log("AudioFeatureExtractor: DSP Iniciado com Meyda");
        } catch (err) {
            console.error("AudioFeatureExtractor: Erro ao iniciar Meyda", err);
        }
    }

    /**
     * Obtém as features do frame atual
     * @returns {Object|null} Features acústicas ou null se não inicializado
     */
    getFeatures() {
        if (!this.meydaAnalyzer) return null;
        
        // Meyda.get() retorna as features do último frame processado
        const features = this.meydaAnalyzer.get([
            'rms', 
            'zcr', 
            'spectralCentroid', 
            'spectralFlatness',
            'energy'
        ]);

        if (!features) return null;

        // Normalização básica para o IRA-SUSI (pré-processamento)
        return {
            rms: features.rms, // [0, 1]
            zcr: features.zcr / (this.bufferSize / 2), // Normaliza [0, 1]
            spectralCentroid: features.spectralCentroid, // Hz
            spectralFlatness: features.spectralFlatness, // [0, 1]
            energy: features.energy,
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

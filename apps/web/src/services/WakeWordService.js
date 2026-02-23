/* global tf, speechCommands */
// import * as speechCommands from '@tensorflow-models/speech-commands';
// import * as tf from '@tensorflow/tfjs';

class WakeWordService {
    constructor() {
        this.model = null;
        this.isListening = false;
        this.onWakeWordDetected = null;
        this.confidenceThreshold = 0.85; // Alta confiança para evitar falsos positivos
    }

    async loadModel() {
        if (this.model) return;

        try {
            // Usa o modelo padrão "Browser FFT" treinado em comandos básicos
            // Palavras disponíveis: "zero" to "nine", "up", "down", "left", "right", "go", "stop", "yes", "no"
            // Para "SOCORRO" (custom), precisaríamos treinar um modelo específico (Transfer Learning).
            // Para este MVP, usaremos "YES" ou "STOP" como gatilho de teste, ou detectaremos som alto.
            
            // Nota: Em produção, usaríamos um modelo customizado hospedado no servidor.
            
            // Access global variable injected via CDN in index.html
            // Wait for window load if needed or check repeatedly
            if (typeof window.speechCommands === 'undefined' && typeof speechCommands === 'undefined') {
                console.warn('TensorFlow Speech Commands not ready yet. Retrying in 1s...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (typeof window.speechCommands === 'undefined' && typeof speechCommands === 'undefined') {
                     console.error('TensorFlow Speech Commands failed to load via CDN');
                     return;
                }
            }
            
            const sc = window.speechCommands || speechCommands;

            this.model = await sc.create('BROWSER_FFT');
            await this.model.ensureModelLoaded();
            
            console.log('Modelo de Wake Word carregado (TensorFlow.js)');
            console.log('Vocabulário:', this.model.wordLabels());
        } catch (error) {
            console.error('Erro ao carregar modelo de voz:', error);
            // throw error; // Don't crash the app if voice model fails
        }
    }

    async startListening(callback, customPhrase = 'stop') {
        if (!this.model) await this.loadModel();
        if (this.isListening) return;

        this.onWakeWordDetected = callback;
        this.isListening = true;

        // O modelo escuta em janelas sobrepostas
        this.model.listen(result => {
            const scores = result.scores;
            // Pega o índice da palavra com maior score
            const bestIndex = scores.indexOf(Math.max(...scores));
            const bestWord = this.model.wordLabels()[bestIndex];
            const confidence = scores[bestIndex];

            // Debug
            // console.log(`Ouvido: ${bestWord} (${(confidence * 100).toFixed(1)}%)`);

            // Mapeamento temporário para MVP (Simulando 'SOCORRO' com palavras do modelo padrão)
            // 'stop' ou 'help' (se disponível) ou 'yes'
            const triggerWords = ['stop', 'no', 'go']; 
            
            // Se a palavra detectada for uma das triggers e a confiança for alta
            if (triggerWords.includes(bestWord) && confidence > this.confidenceThreshold) {
                console.log(`Wake Word Detectada: ${bestWord}`);
                if (this.onWakeWordDetected) {
                    this.onWakeWordDetected(bestWord);
                }
            }
        }, {
            includeSpectrogram: false,
            probabilityThreshold: 0.75,
            invokeCallbackOnNoiseAndUnknown: false,
            overlapFactor: 0.50 // Processa a cada 500ms aprox
        });
    }

    stopListening() {
        if (this.isListening && this.model) {
            this.model.stopListening();
            this.isListening = false;
        }
    }

    // Método para transfer learning (Futuro: Treinar "SOCORRO" no navegador do usuário)
    async collectExample(label) {
        if (!this.transferModel) {
             this.transferModel = speechCommands.create('BROWSER_FFT');
             // Lógica de coleta...
        }
    }
}

export default new WakeWordService();

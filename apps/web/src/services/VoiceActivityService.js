// VoiceActivityService.js
// Serviço de Detecção de Atividade de Voz (VAD) usando Silero VAD (via @ricky0123/vad-web)
// Filtra silêncio e ruído, garantindo que só processamos fala humana.

import { MicVAD } from "@ricky0123/vad-web";

class VoiceActivityService {
    constructor() {
        this.vadInstance = null;
        this.isListening = false;
        this.onSpeechStart = null;
        this.onSpeechEnd = null;
    }

    async start(onSpeechStart, onSpeechEnd) {
        if (this.isListening) return;

        this.onSpeechStart = onSpeechStart;
        this.onSpeechEnd = onSpeechEnd;

        try {
            // Tentar carregar modelo localmente para evitar erros de rede/CORS com CDN
            // Os arquivos .onnx e .mjs devem estar na pasta public/
            this.vadInstance = await MicVAD.new({
                // Tenta apontar para os modelos locais (se a biblioteca suportar overrides de URL de modelo)
                // Se não suportar nativamente no construtor 'new', ele vai tentar baixar da CDN padrão.
                // Mas podemos injetar o ort (ONNX Runtime) configurado se necessário.
                
                // Opções de runtime
                onSpeechStart: () => {
                    console.log("[VAD] Fala detectada...");
                    if (this.onSpeechStart) this.onSpeechStart();
                },
                onSpeechEnd: (audio) => {
                    console.log("[VAD] Fala terminou.");
                    if (this.onSpeechEnd) this.onSpeechEnd(audio);
                },
                onVADMisfire: () => {
                    console.log("[VAD] Misfire (Ruído curto ignorado).");
                },
                // Configurações otimizadas para detecção rápida
                positiveSpeechThreshold: 0.6,
                negativeSpeechThreshold: 0.4,
                minSpeechFrames: 5,
                preSpeechPadFrames: 10,
                redemptionFrames: 8,
                
                // Tentar forçar caminhos locais (depende da versão da lib, mas vale a tentativa de configuração global do ORT antes)
                // workletURL: '/ort-wasm-simd-threaded.mjs', // Exemplo hipotético se a lib expusesse
                // modelURL: '/silero_vad_legacy.onnx' 
            });

            this.vadInstance.start();
            this.isListening = true;
            console.log("VAD (Voice Activity Detection) iniciado.");
        } catch (error) {
            console.error("Erro ao iniciar VAD:", error);
        }
    }

    stop() {
        if (this.vadInstance) {
            this.vadInstance.pause();
            this.vadInstance = null;
        }
        this.isListening = false;
    }
}

export default new VoiceActivityService();

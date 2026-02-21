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
            this.vadInstance = await MicVAD.new({
                onSpeechStart: () => {
                    console.log("[VAD] Fala detectada...");
                    if (this.onSpeechStart) this.onSpeechStart();
                },
                onSpeechEnd: (audio) => {
                    console.log("[VAD] Fala terminou.");
                    if (this.onSpeechEnd) this.onSpeechEnd(audio);
                },
                // Configurações otimizadas para detecção rápida
                positiveSpeechThreshold: 0.6,
                negativeSpeechThreshold: 0.4,
                minSpeechFrames: 5,
                preSpeechPadFrames: 10,
                redemptionFrames: 8
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

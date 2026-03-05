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
        // URL do backend Railway (Hardcoded para garantir produção)
        // FIX: Usar URL direta para evitar problemas de env em produção
        this.apiEndpoint = 'https://suse-df-web-production.up.railway.app';
    }

    async start(onSpeechStart, onSpeechEnd) {
        if (this.isListening) return;

        this.onSpeechStart = onSpeechStart;
        this.onSpeechEnd = onSpeechEnd;

        try {
            // Tentar carregar modelo localmente para evitar erros de rede/CORS com CDN
            // Os arquivos .onnx e .mjs devem estar na pasta public/
            // FIX: Garantir URL base correta para production
            const baseUrl = window.location.origin;
            
            // Verificação de segurança: checar se os arquivos existem antes de tentar carregar
            console.log(`[VAD Init] Carregando modelos de: ${baseUrl}`);
            
            this.vadInstance = await MicVAD.new({
                // Tenta forçar caminhos locais e ABSOLUTOS
                workletURL: `/ort-wasm-simd-threaded.mjs`, // Caminho absoluto para evitar /passenger/ort...
                modelURL: `/silero_vad_legacy.onnx`, // Caminho absoluto para evitar /passenger/silero...
                
                // Opções de runtime
                onSpeechStart: () => {
                    console.log("[VAD] Fala detectada...");
                    if (this.onSpeechStart) this.onSpeechStart();
                },
                onSpeechEnd: async (audio) => {
                    console.log("[VAD] Fala terminou. Enviando para análise...");
                    
                    // Converter Float32Array (audio) para Base64 WAV
                    const base64Audio = await this.audioBufferToBase64(audio);
                    
                    // Enviar para o Backend
                    this.analyzeAudio(base64Audio);
                    
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

    async analyzeAudio(base64Audio) {
        try {
            const response = await fetch(`${this.apiEndpoint}/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    audio_base64: base64Audio,
                    user_id: null // TODO: Injetar ID do usuário logado se necessário para biometria
                })
            });

            if (!response.ok) {
                throw new Error(`Erro API: ${response.status}`);
            }

            const result = await response.json();
            console.log("[VAD] Resultado da Análise:", result);
            
            // Disparar evento customizado para a UI atualizar (ou usar callback)
            const event = new CustomEvent('voice-analysis-result', { detail: result });
            window.dispatchEvent(event);

        } catch (error) {
            console.error("[VAD] Erro ao enviar áudio:", error);
        }
    }

    // Utilitário para converter Float32Array do VAD para WAV Base64
    async audioBufferToBase64(audioData) {
        // Criar WAV header + PCM data
        const sampleRate = 16000; // VAD usa 16kHz
        const buffer = this.encodeWAV(audioData, sampleRate);
        const blob = new Blob([buffer], { type: 'audio/wav' });
        
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });
    }

    encodeWAV(samples, sampleRate) {
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
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
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
        return view;
    }
}


export default new VoiceActivityService();

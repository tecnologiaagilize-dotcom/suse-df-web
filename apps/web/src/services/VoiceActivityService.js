// VoiceActivityService.js
// VAD Híbrido:
// 1. Tenta usar Silero VAD (Melhor qualidade, mas pesado e requer WASM)
// 2. Se falhar, faz fallback para Energy-Based VAD (Nativo, leve, infalível)

import { MicVAD } from "@ricky0123/vad-web";

class VoiceActivityService {
    constructor() {
        this.vadInstance = null;
        this.isListening = false;
        this.onSpeechStart = null;
        this.onSpeechEnd = null;
        this.apiEndpoint = 'https://suse-df-web-production.up.railway.app';
        
        // Estado do Fallback (Energy VAD)
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.energyInterval = null;
        this.speechStartTime = 0;
        this.isSpeaking = false;
    }

    async start(onSpeechStart, onSpeechEnd, externalStream = null) {
        if (this.isListening) return;

        this.onSpeechStart = onSpeechStart;
        this.onSpeechEnd = onSpeechEnd;

        // Se houver stream externo, forçamos o uso do VAD Nativo para evitar conflito de hardware
        // O Silero (MicVAD) tenta gerenciar o microfone sozinho, o que causaria erro "Device in use".
        if (externalStream) {
             console.log("[VAD] Stream externo detectado. Usando VAD Nativo (Shared Stream Mode).");
             await this.startNativeEnergyVAD(externalStream);
             return;
        }

        // Tentar Silero VAD primeiro (Apenas se não houver stream externo)
        try {
            console.log("[VAD Init] Tentando Silero VAD...");
            this.vadInstance = await MicVAD.new({
                // Usar caminhos absolutos
                workletURL: `/ort-wasm-simd-threaded.mjs`,
                modelURL: `/silero_vad_legacy.onnx`,
                
                onSpeechStart: () => {
                    console.log("[Silero VAD] Fala detectada...");
                    if (this.onSpeechStart) this.onSpeechStart();
                },
                onSpeechEnd: async (audio) => {
                    console.log("[Silero VAD] Fala terminou.");
                    if (this.onSpeechEnd) this.onSpeechEnd(audio);
                },
                onVADMisfire: () => { console.log("[Silero VAD] Ruído ignorado."); },
                positiveSpeechThreshold: 0.6,
                minSpeechFrames: 5,
            });

            this.vadInstance.start();
            this.isListening = true;
            console.log("[VAD] Silero VAD iniciado com sucesso.");
            return;

        } catch (error) {
            console.warn("[VAD] Falha ao iniciar Silero VAD (WASM/404). Iniciando Fallback Nativo...", error);
            await this.startNativeEnergyVAD();
        }
    }

    async startNativeEnergyVAD(externalStream = null) {
        try {
            console.log("[VAD Nativo] Iniciando VAD baseado em Energia...");
            
            let stream = externalStream;
            
            // Se não foi passado stream, solicita um novo (Comportamento legado)
            if (!stream) {
                 stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { 
                        echoCancellation: true, 
                        noiseSuppression: true,
                        autoGainControl: true 
                    } 
                });
            }

            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            this.source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 512;
            this.analyser.smoothingTimeConstant = 0.2;
            this.source.connect(this.analyser);

            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            // Limiar de silêncio (ajustável)
            // AUMENTADO para 45 (era 25) para evitar disparos falsos com ruído de fundo (v1.3.39)
            const VOICE_THRESHOLD = 45; // 0-255. Valor empírico calibrado.
            let silenceStartTime = 0;
            let speechDuration = 0;

            // Loop de detecção (50ms)
            this.energyInterval = setInterval(() => {
                this.analyser.getByteFrequencyData(dataArray);
                
                // Calcular volume médio (RMS aproximado)
                let sum = 0;
                for(let i = 0; i < bufferLength; i++) sum += dataArray[i];
                const average = sum / bufferLength;

                // Lógica de Detecção
                if (average > VOICE_THRESHOLD) {
                    if (!this.isSpeaking) {
                        // Filtro de Ruído Transitório (Pico curto)
                        // Apenas considera fala se sustentar por pelo menos 2 frames (100ms) - Lógica simplificada aqui
                        this.isSpeaking = true;
                        this.speechStartTime = Date.now();
                        console.log(`[VAD Nativo] Fala Detectada (Vol: ${average.toFixed(1)} > ${VOICE_THRESHOLD})`);
                        if (this.onSpeechStart) this.onSpeechStart();
                    }
                    silenceStartTime = 0;
                    speechDuration += 50;
                } else {
                    if (this.isSpeaking) {
                        if (silenceStartTime === 0) silenceStartTime = Date.now();
                        
                        // Debounce AUMENTADO de 800ms para 1500ms para evitar cortes em frases pausadas
                        if (Date.now() - silenceStartTime > 1500) {
                            this.isSpeaking = false;
                            console.log("[VAD Nativo] Fim da fala (Silêncio sustentado > 1.5s).");
                            if (this.onSpeechEnd) this.onSpeechEnd(null); 
                        }
                    }
                }
            }, 50);

            this.isListening = true;
            console.log("[VAD] VAD Nativo (Energia) Operante.");

        } catch (e) {
            console.error("[VAD Crítico] Falha total ao iniciar VAD Nativo:", e);
        }
    }

    stop() {
        // Parar Silero
        if (this.vadInstance) {
            this.vadInstance.pause();
            this.vadInstance = null;
        }

        // Parar Nativo
        if (this.energyInterval) clearInterval(this.energyInterval);
        if (this.source) {
            // NÃO paramos as tracks se o stream for externo (compartilhado), apenas desconectamos o nó
            // Mas como não salvamos a flag 'isExternal', por segurança desconectamos apenas.
            // Para evitar parar o audio do EmergencyListener, não chamamos track.stop() aqui se for compartilhado.
            // TODO: Adicionar flag this.isExternalStream
            
            // Por enquanto, assumimos que se o AudioContext for fechado, o nó morre.
            this.source.disconnect();
        }
        if (this.audioContext) this.audioContext.close();

        this.isListening = false;
        this.isSpeaking = false;
    }

    // Método legado mantido para compatibilidade, mas o VAD nativo não envia áudio
    async analyzeAudio(base64Audio) {
       // ... (código existente)
    }
    
    // ... (restante dos métodos auxiliares)
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

// VoiceBiometryService.js
// Simulates a professional Voice Biometry Engine
// In a production environment, this would interface with a Python Backend (TensorFlow/PyTorch)
// or a cloud service like Azure Speech / AWS Transcribe.

import { supabase } from '../lib/supabase';
import AudioFeatureExtractor from './AudioFeatureExtractor';

const VoiceBiometryService = {
    /**
     * Calcula a similaridade entre duas strings usando Distância de Levenshtein
     * (Mantido localmente pois é rápido e eficiente para Keyword Spotting)
     */
    calculateSimilarity: (s, t) => {
        // ... (manter igual)
        if (!s || !t) return 0.0;
        
        const sLower = s.toLowerCase().trim();
        const tLower = t.toLowerCase().trim();
        
        if (sLower === tLower) return 1.0;
        if (sLower.includes(tLower)) return 1.0;

        const lenS = sLower.length;
        const lenT = tLower.length;
        const maxLen = Math.max(lenS, lenT);
        
        if (maxLen === 0) return 1.0;

        const d = [];
        for (let i = 0; i <= lenS; i++) d[i] = [i];
        for (let j = 0; j <= lenT; j++) d[0][j] = j;

        for (let j = 1; j <= lenT; j++) {
            for (let i = 1; i <= lenS; i++) {
                if (sLower[i - 1] === tLower[j - 1]) {
                    d[i][j] = d[i - 1][j - 1];
                } else {
                    d[i][j] = Math.min(
                        d[i - 1][j] + 1,
                        d[i][j - 1] + 1,
                        d[i - 1][j - 1] + 1
                    );
                }
            }
        }

        return 1.0 - (d[lenS][lenT] / maxLen);
    },

    /**
     * Baixa e converte um áudio URL para AudioBuffer
     */
    fetchAudioBuffer: async (url) => {
        if (!url) return null;
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            return await audioContext.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error("Erro ao baixar/decodificar áudio de referência:", url, e);
            return null;
        }
    },

    /**
     * Calcula Distância Euclidiana entre dois vetores MFCC
     * Quanto MENOR, mais parecido.
     */
    calculateEuclideanDistance: (v1, v2) => {
        if (!v1 || !v2 || v1.length !== v2.length) return Infinity;
        let sum = 0;
        for (let i = 0; i < v1.length; i++) {
            sum += Math.pow(v1[i] - v2[i], 2);
        }
        return Math.sqrt(sum);
    },

    /**
     * Verifica a identidade do locutor usando Biometria Real via Backend
     * Com FALLBACK HÍBRIDO LOCAL (v1.5) usando MFCC das frases gravadas
     * @param {Blob} audioBlob - O áudio capturado para verificação
     * @returns {Promise<{isVerified: boolean, score: number, details: any}>}
     */
    verifySpeakerIdentity: async (audioBlob) => {
        try {
            console.log("[Biometria] Iniciando verificação híbrida (Local + Remota)...");
            
            // 1. Preparar o áudio para envio
            const reader = new FileReader();
            const audioBase64 = await new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(audioBlob);
            });

            const { data: { user } } = await supabase.auth.getUser();
            const BIOMETRY_SERVICE_URL = import.meta.env.VITE_BIOMETRY_SERVICE_URL;

            // --- TENTATIVA 1: BACKEND EXTERNO (Railway/Python) ---
            if (BIOMETRY_SERVICE_URL) {
                console.log(`[Biometria] Chamando Railway direto: ${BIOMETRY_SERVICE_URL}`);
                try {
                    const response = await fetch(`${BIOMETRY_SERVICE_URL}/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            audio_base64: audioBase64, 
                            user_id: user?.id 
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        console.log("[Biometria] Resultado Railway:", data);
                        return { isVerified: data.is_verified, score: data.score, details: data.details };
                    }
                } catch (e) {
                    console.warn("[Biometria] Falha ao conectar ao Backend Python. Tentando Fallback Local...", e);
                }
            }

            // --- TENTATIVA 2: FALLBACK LOCAL (MFCC Fingerprint) ---
            // Se o backend falhar ou não existir, usamos as frases gravadas no perfil
            console.log("[Biometria] Iniciando Verificação Local (MFCC)...");
            
            // Buscar perfil do usuário para pegar URLs das frases
            const { data: profile } = await supabase
                .from('users')
                .select('voice_biometry_1_url, voice_biometry_2_url, voice_biometry_3_url, secret_word_audio_url')
                .eq('id', user.id)
                .single();

            if (!profile) {
                console.warn("[Biometria] Perfil não encontrado. Fail-Open inseguro.");
                return { isVerified: true, score: 0.5, details: "Fail-Open (Sem Perfil)" };
            }

            // Converter Probe (AudioBlob) para AudioBuffer
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const probeArrayBuffer = await audioBlob.arrayBuffer();
            const probeAudioBuffer = await audioContext.decodeAudioData(probeArrayBuffer);
            
            // Extrair MFCC do Probe
            // Precisamos criar uma instância temporária ou usar o método estático se fosse estático
            // O AudioFeatureExtractor é um singleton exportado como 'new AudioFeatureExtractor()'
            // Mas o método extractOfflineFingerprint usa 'Meyda' diretamente, então funciona
            const probeMfcc = AudioFeatureExtractor.extractOfflineFingerprint(probeAudioBuffer);
            
            if (!probeMfcc) {
                console.warn("[Biometria] Falha ao extrair MFCC do áudio de prova.");
                return { isVerified: false, score: 0, details: "Falha Técnica (MFCC Probe)" };
            }

            // Baixar e processar referências (paralelo)
            const refUrls = [
                profile.voice_biometry_1_url,
                profile.voice_biometry_2_url,
                profile.voice_biometry_3_url,
                profile.secret_word_audio_url
            ].filter(Boolean);

            if (refUrls.length === 0) {
                console.warn("[Biometria] Nenhuma frase de referência encontrada. Fail-Open.");
                return { isVerified: true, score: 0.5, details: "Fail-Open (Sem Referências)" };
            }

            let minDistance = Infinity;
            let avgDistance = 0;
            let validRefs = 0;

            for (const url of refUrls) {
                const refBuffer = await VoiceBiometryService.fetchAudioBuffer(url);
                if (refBuffer) {
                    const refMfcc = AudioFeatureExtractor.extractOfflineFingerprint(refBuffer);
                    if (refMfcc) {
                        const dist = VoiceBiometryService.calculateEuclideanDistance(probeMfcc, refMfcc);
                        console.log(`[Biometria] Distância MFCC para ${url.split('/').pop()}: ${dist.toFixed(2)}`);
                        if (dist < minDistance) minDistance = dist;
                        avgDistance += dist;
                        validRefs++;
                    }
                }
            }

            if (validRefs === 0) {
                 return { isVerified: true, score: 0.5, details: "Fail-Open (Erro Download Referências)" };
            }
            
            avgDistance /= validRefs;
            console.log(`[Biometria] Distância Mínima: ${minDistance.toFixed(2)}, Média: ${avgDistance.toFixed(2)}`);

            // --- THRESHOLD DECISION ---
            // MFCC Distance (Euclidean) empírica:
            // Mesma pessoa ~ 15-25
            // Pessoas diferentes > 35-40
            // Ruído pode afetar muito. Vamos ser conservadores.
            // Se for MENOR que 35, aceitamos.
            
            const THRESHOLD = 35.0; 
            const isVerified = minDistance < THRESHOLD;

            return { 
                isVerified: isVerified, 
                score: Math.max(0, 100 - minDistance), // Score fictício baseado na distância
                details: `Verificação Local (MFCC). Dist: ${minDistance.toFixed(1)}` 
            };

        } catch (error) {
            console.error("[Biometria] Erro fatal na verificação:", error);
            // FAIL-SAFE PARA ERRO GERAL
            // Se der erro de código, não bloqueia emergência (mas loga erro)
            return { isVerified: true, score: 1.0, details: "Fail-Open (Crash Handler)" };
        }
    },


    /**
     * Analisa o ruído ambiente (Placeholder para implementação futura)
     */
    analyzeEnvironment: async () => {
        return {
            noiseLevel: 'low',
            snr: 25,
            isSafeEnvironment: true
        };
    }
};

export default VoiceBiometryService;

// VoiceBiometryService.js
// Simulates a professional Voice Biometry Engine
// In a production environment, this would interface with a Python Backend (TensorFlow/PyTorch)
// or a cloud service like Azure Speech / AWS Transcribe.

import { supabase } from '../lib/supabase';

const VoiceBiometryService = {
    /**
     * Calcula a similaridade entre duas strings usando Distância de Levenshtein
     * (Mantido localmente pois é rápido e eficiente para Keyword Spotting)
     */
    calculateSimilarity: (s, t) => {
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
     * Verifica a identidade do locutor usando Biometria Real via Backend
     * @param {Blob} audioBlob - O áudio capturado para verificação
     * @returns {Promise<{isVerified: boolean, score: number, details: any}>}
     */
    verifySpeakerIdentity: async (audioBlob) => {
        try {
            console.log("[Biometria] Iniciando verificação real no servidor...");
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.warn("[Biometria] Usuário não autenticado. Fail-Open.");
                return { isVerified: true, score: 1.0, details: "Fail-Open (No User)" };
            }

            // URL do serviço Python (Railway)
            // Se não estiver definida, usa Fallback Fail-Open para não bloquear emergência
            const API_URL = import.meta.env.VITE_BIOMETRY_API_URL;

            if (API_URL) {
                console.log(`[Biometria] Enviando áudio para IA: ${API_URL}`);
                
                const formData = new FormData();
                formData.append('audio_file', audioBlob, 'emergency.wav');
                formData.append('user_id', user.id);
                formData.append('reference_type', 'secret_word');

                const response = await fetch(`${API_URL}/verify`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    console.error("[Biometria] Erro no servidor:", await response.text());
                    // Fail-Open em caso de erro 500 do servidor de IA
                    return { isVerified: true, score: 1.0, details: "Fail-Open (Server Error)" };
                }

                const data = await response.json();
                console.log("[Biometria] Resultado IA:", data);
                
                return { 
                    isVerified: data.verified, 
                    score: data.score, 
                    details: data.details 
                };

            } else {
                console.warn("[Biometria] VITE_BIOMETRY_API_URL não definida. Modo Fail-Closed (Segurança Ativa).");
                // MUDANÇA: Fail-Closed para evitar falsos positivos sem backend
                return { isVerified: false, score: 0.0, details: "Fail-Closed (Backend Missing)" };
            }

        } catch (error) {
            console.error("[Biometria] Erro de rede/cliente:", error);
            // MUDANÇA: Fail-Closed em erro de rede também para evitar bypass
            return { isVerified: false, score: 0.0, details: "Fail-Closed (Network Error)" };
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

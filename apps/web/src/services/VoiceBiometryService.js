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
            
            // 1. Preparar o áudio para envio (FormData ou Base64)
            // Para Edge Functions, geralmente enviamos como Base64 ou Multipart
            // Vamos converter para Base64 para facilitar o JSON payload
            const reader = new FileReader();
            const audioBase64 = await new Promise((resolve, reject) => {
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(audioBlob);
            });

            // AQUI ENTRA A MUDANÇA: Chamada direta ao serviço Python (Opção B)
            // para contornar a limitação de não poder fazer deploy da Edge Function via CLI.
            // O serviço Python deve ter CORS habilitado para '*'.
            
            const BIOMETRY_SERVICE_URL = import.meta.env.VITE_BIOMETRY_SERVICE_URL;

            if (BIOMETRY_SERVICE_URL) {
                // 2a. Chamada direta ao Railway
                console.log(`[Biometria] Chamando Railway direto: ${BIOMETRY_SERVICE_URL}`);
                
                // Precisamos do ID do usuário. O frontend deve passar ou pegamos do supabase.auth
                const { data: { user } } = await supabase.auth.getUser();
                
                const response = await fetch(`${BIOMETRY_SERVICE_URL}/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        audio_base64: audioBase64, 
                        user_id: user?.id 
                    })
                });

                if (!response.ok) throw new Error("Erro no serviço de biometria externo");
                const data = await response.json();
                
                console.log("[Biometria] Resultado Railway:", data);
                return { isVerified: data.is_verified, score: data.score, details: data.details };

            } else {
                // 2b. Fallback para Edge Function (se um dia for configurada)
                const { data, error } = await supabase.functions.invoke('verify-biometry', {
                    body: { audio: audioBase64 }
                });

                if (error) {
                    // MODO FAIL-OPEN DE EMERGÊNCIA
                    // Se não tem backend configurado, mas a palavra chave bateu,
                    // em emergência real nós APROVAMOS para não bloquear o socorro.
                    console.warn("[Biometria] Backend inacessível. Fail-Open ativado.");
                    return { isVerified: true, score: 1.0, details: "Fail-Open (Backend Offline)" };
                }

                return { isVerified: data.isVerified, score: data.score, details: data };
            }

        } catch (error) {
            console.error("[Biometria] Erro fatal na verificação:", error);
            // Relançar o erro para que o componente consumidor (Listener)
            // possa aplicar a política de Fail-Open (acionar emergência mesmo com erro)
            throw error;
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

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
     * Define o baseline acústico do usuário para verificação local
     * @param {Object} baseline - Objeto com { mu, sigma } para cada feature
     */
    setBaseline: (baseline) => {
        if (baseline) {
            VoiceBiometryService._userBaseline = baseline;
            console.log("[Biometria] Baseline local carregado:", baseline);
        }
    },

    /**
     * Verificação Biométrica Local (IRA-Match)
     * Compara as features acústicas atuais com o baseline gravado pelo usuário.
     * @param {Object} currentFeatures - Features extraídas pelo AudioFeatureExtractor
     * @returns {Object} { isVerified: boolean, score: number, distance: number }
     */
    verifySpeakerIdentityLocal: (currentFeatures) => {
        const baseline = VoiceBiometryService._userBaseline;
        
        if (!baseline || !currentFeatures) {
            console.warn("[Biometria] Baseline ou Features ausentes para verificação local.");
            return { isVerified: false, score: 0, reason: "Dados insuficientes" };
        }

        // Features chave para assinatura vocal (baseado no IRA-SUSI)
        const keys = ['pitch', 'jitter', 'shimmer', 'hnr', 'energy']; 
        // Energy é menos confiável pois depende da distância do mic, mas ajuda no contexto.
        
        let totalZScore = 0;
        let validKeys = 0;

        const debugDiffs = {};

        keys.forEach(key => {
            if (baseline[key] && currentFeatures[key] !== undefined) {
                const mu = baseline[key].mu;
                const sigma = Math.max(baseline[key].sigma, 0.001); // Evita divisão por zero
                
                // Normaliza feature atual (algumas podem estar em escalas diferentes, mas o extractor deve ser consistente)
                // Nota: AudioFeatureExtractor retorna 'dbfs' para energia, 'pitch' em Hz, etc.
                // Precisamos garantir que estamos comparando maçãs com maçãs.
                // O VoiceConfig usa as mesmas chaves do AudioFeatureExtractor, então deve bater.
                
                let value = currentFeatures[key];
                if (key === 'energy') value = currentFeatures['dbfs']; // Mapeamento correto

                const diff = Math.abs(value - mu);
                const zScore = diff / sigma;
                
                // Peso: Pitch e HNR são mais característicos da voz que energia
                const weight = (key === 'pitch' || key === 'hnr') ? 1.5 : 1.0;
                
                totalZScore += zScore * weight;
                validKeys += weight;

                debugDiffs[key] = { val: value.toFixed(2), mu: mu.toFixed(2), z: zScore.toFixed(2) };
            }
        });

        if (validKeys === 0) return { isVerified: false, score: 0, reason: "Nenhuma feature válida" };

        const avgZScore = totalZScore / validKeys;
        
        // Threshold: 
        // Z-Score < 1.0 = Muito parecido (Dentro de 1 sigma)
        // Z-Score < 2.0 = Parecido (Dentro de 2 sigmas - 95% confiança)
        // Z-Score < 3.0 = Diferente
        
        // Vamos ser estritos mas realistas: < 2.5
        const isVerified = avgZScore < 2.5;
        
        // Converter Z-Score (0 a inf) para Score de Confiança (0 a 100)
        // Z=0 -> 100%, Z=3 -> 0%
        const confidence = Math.max(0, 100 - (avgZScore * 33));

        console.log(`[Biometria Local] Z-Score Médio: ${avgZScore.toFixed(2)} (${isVerified ? 'OK' : 'FAIL'})`, debugDiffs);

        return { 
            isVerified, 
            score: confidence, 
            distance: avgZScore,
            details: debugDiffs
        };
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
                    // MODO STRICT-SAFE DE EMERGÊNCIA (v3.1)
                    // Se não tem backend, NÃO podemos aprovar cegamente (causa falso positivo).
                    // Só aprovamos "Fail-Open" se houver indício local forte (Simulado aqui por false, 
                    // pois o Listener já trata o fail-safe com sensores físicos).
                    console.warn("[Biometria] Backend inacessível. Fail-Open DESATIVADO para evitar falsos positivos.");
                    return { isVerified: false, score: 0.0, details: "Backend Offline - Strict Mode" };
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

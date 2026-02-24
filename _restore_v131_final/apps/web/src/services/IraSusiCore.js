/**
 * IRA-SUSI™ Core Engine (v1.0)
 * Índice de Risco Acústico - Sistema Unificado de Segurança Inteligente
 * 
 * Implementação fiel ao Caderno Técnico Oficial.
 * Fórmula: IRA_t = Sigmoid(b + St + βQt + ηAt + Ct)
 */

class IraSusiCore {
    constructor() {
        // Configurações Iniciais (v1.0)
        this.config = {
            bias: -1.2, // b: Viés conservador
            weights: {
                rms: 0.25,
                deltaEnergy: 0.35,
                scream: 1.20, // Peso alto para gritos
                biometry: 0.60, // β
                history: 0.30, // η
                context: 0.40
            },
            gates: {
                vadThreshold: 0.05, // Gate 1: Mínimo de energia para considerar
                noiseFloorAlpha: 0.01 // Fator de aprendizado do ruído de fundo
            },
            smoothing: 0.85 // Fator de suavização temporal (evita piscadas)
        };

        // Estado Interno
        this.state = {
            iraHat: 0, // IRA suavizado anterior (t-1)
            baselineEnergy: 0.01, // Nível de ruído aprendido
            lastEnergy: 0,
            status: 'NORMAL'
        };
    }

    /**
     * Função Sigmoide
     * @param {number} x 
     * @returns {number} [0, 1]
     */
    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    /**
     * Calcula o IRA instantâneo
     * @param {Object} features - Features do AudioFeatureExtractor
     * @param {number} biometryScore - [0, 1] (Opcional, default 0)
     * @param {Object} context - Dados de contexto (GPS, Acelerômetro)
     */
    processFrame(features, biometryScore = 0, context = {}) {
        if (!features) return this.getResult();

        // 1. Atualizar Baseline (Ruído de Fundo)
        // Se a energia atual for baixa, assumimos que é ruído de fundo e aprendemos
        if (features.rms < this.state.baselineEnergy * 1.5) {
            this.state.baselineEnergy = (this.state.baselineEnergy * (1 - this.config.gates.noiseFloorAlpha)) + 
                                        (features.rms * this.config.gates.noiseFloorAlpha);
        }

        // 2. Calcular Derivada da Energia (Ataque/Explosão Sonora)
        const deltaEnergy = Math.max(0, features.rms - this.state.lastEnergy);
        this.state.lastEnergy = features.rms;

        // 3. Detecção de Grito (Heurística Simplificada v1.0)
        // Gritos têm alta energia E alto brilho espectral (agudos)
        const isScreamCandidate = features.rms > 0.3 && features.spectralCentroid > 2000;
        const screamScore = isScreamCandidate ? 1.0 : 0.0;

        // 4. Gate 1: Filtro de Silêncio
        // Se energia < limiar E não é grito, zera o score acústico
        const g1 = (features.rms > this.config.gates.vadThreshold || screamScore > 0) ? 1.0 : 0.15;

        // 5. Score Acústico (St)
        // S* = w1*RMS + w2*Delta + w3*Grito
        const S_star = (this.config.weights.rms * features.rms) + 
                       (this.config.weights.deltaEnergy * deltaEnergy) +
                       (this.config.weights.scream * screamScore);
        
        const S_t = S_star * g1;

        // 6. Fatores Externos
        const Q_t = biometryScore * this.config.weights.biometry;
        
        // 7. Contexto Físico (Ct)
        // Ct = Impacto + Velocidade
        let C_t = 0;
        
        // Se houver impacto físico (batida), o risco aumenta muito
        if (context.impactDetected) {
            C_t += 0.5; // +50% de risco
        }

        // Se estiver em alta velocidade (> 15km/h), o ambiente é mais perigoso
        if (context.speed > 15) {
            C_t += 0.2; // +20% de risco base
        }

        // 8. Fórmula Final
        // IRA_raw = b + St + Qt + Ct
        const rawIRA = this.config.bias + S_t + Q_t + C_t;
        const ira_t = this.sigmoid(rawIRA);

        // 9. Suavização Temporal (Filtro Passa-Baixa)
        // IRA_hat_t = α * IRA_hat_{t-1} + (1-α) * IRA_t
        this.state.iraHat = (this.config.smoothing * this.state.iraHat) + 
                            ((1 - this.config.smoothing) * ira_t);

        // 10. Máquina de Estados (Thresholds)
        this.updateStatus();

        return this.getResult();
    }

    updateStatus() {
        const score = this.state.iraHat;
        
        // Histerese para evitar oscilação
        if (score > 0.85) this.state.status = 'EMERGENCIA';
        else if (score > 0.70) this.state.status = 'RISCO';
        else if (score > 0.50) this.state.status = 'ATENCAO';
        else if (score < 0.40) this.state.status = 'NORMAL'; // Só baixa se cair bem
    }

    getResult() {
        return {
            score: this.state.iraHat, // 0.0 a 1.0
            status: this.state.status, // NORMAL, ATENCAO, RISCO, EMERGENCIA
            debug: {
                baseline: this.state.baselineEnergy
            }
        };
    }

    reset() {
        this.state.iraHat = 0;
        this.state.status = 'NORMAL';
    }
}

export default new IraSusiCore();

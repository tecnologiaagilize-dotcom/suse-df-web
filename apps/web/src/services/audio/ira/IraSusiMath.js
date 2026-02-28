// IRA-SUSI v1.0 - Mathematical Core
// Implementação das funções de transformação e normalização conforme documento mat1

export class IraSusiMath {
  constructor() {
    // Pesos iniciais v1.0
    this.weights = {
      energy: 0.25,
      deltaEnergy: 0.35,
      pitch: 0.25,
      deltaPitch: 0.30,
      jitter: 0.20,
      shimmer: 0.15,
      hnr: 0.20,
      scream: 1.20,
      keyword: 0.60
    };

    // Parâmetros de baseline (Adaptive History)
    this.lambda = 0.995;
    this.baseline = {
      energy: { mean: -30, var: 36 }, // dBFS
      pitch: { mean: 170, var: 1600 }, // Hz
      jitter: { mean: 0.005, var: 0.00000625 },
      shimmer: { mean: 0.03, var: 0.000225 },
      hnr: { mean: 15, var: 25 } // dB
    };

    // Viés estrutural
    this.bias = -1.2;
  }

  // Função Sigmoid: σ(x) = 1 / (1 + e^(-x))
  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  // Função Clip: min(max(x,a), b)
  clip(x, a, b) {
    return Math.min(Math.max(x, a), b);
  }

  // Transformações Robustas (φ_i)
  phiEnergy(dbfs) {
    return this.clip((dbfs + 45) / 30, 0, 1);
  }

  phiDeltaEnergy(delta) {
    return this.clip(delta / 12, 0, 1);
  }

  phiPitch(zScore) {
    return this.clip(Math.abs(zScore) / 3, 0, 1);
  }

  phiDeltaPitch(delta) {
    return this.clip((delta - 25) / 35, 0, 1);
  }

  phiJitter(val) {
    return this.clip((val - 0.002) / 0.01, 0, 1); // Ajustado para escala decimal (0.2% -> 0.002)
  }

  phiShimmer(val) {
    return this.clip((val - 0.01) / 0.05, 0, 1); // Ajustado para escala decimal (1% -> 0.01)
  }

  phiHNR(val) {
    return this.clip((20 - val) / 15, 0, 1); // Invertido: menor HNR é pior
  }

  phiScream(prob) {
    return this.clip(prob, 0, 1);
  }

  // Atualização do Baseline Adaptativo (History)
  updateBaseline(metric, value, isNormalState) {
    if (!isNormalState) return;

    const bl = this.baseline[metric];
    if (!bl) return;

    // μ_t = λ μ_{t−1} + (1 − λ)x_t
    bl.mean = this.lambda * bl.mean + (1 - this.lambda) * value;

    // σ²_t = λ σ²_{t−1} + (1 − λ)(x_t − μ_t)²
    bl.var = this.lambda * bl.var + (1 - this.lambda) * Math.pow(value - bl.mean, 2);
  }

  // Cálculo do Z-Score: (x - μ) / (σ + ε)
  getZScore(metric, value) {
    const bl = this.baseline[metric];
    if (!bl) return 0;
    const stdDev = Math.sqrt(bl.var);
    return (value - bl.mean) / (stdDev + 1e-6);
  }

  // Cálculo final do IRA_t
  computeIRA(features, context = 0, biometrics = 0, historyAnomaly = 0) {
    // 1. Calcular φ_i para cada feature
    const pE = this.phiEnergy(features.energy);
    const pDE = this.phiDeltaEnergy(features.deltaEnergy);
    const pF0 = this.phiPitch(this.getZScore('pitch', features.pitch));
    const pDF0 = this.phiDeltaPitch(features.deltaPitch);
    const pJit = this.phiJitter(features.jitter);
    const pShr = this.phiShimmer(features.shimmer);
    const pHNR = this.phiHNR(features.hnr);
    const pG = this.phiScream(features.screamProb);

    // 2. Combinar Bloco Acústico (S*_t)
    let S_star = 
      this.weights.energy * pE +
      this.weights.deltaEnergy * pDE +
      this.weights.pitch * pF0 +
      this.weights.deltaPitch * pDF0 +
      this.weights.jitter * pJit +
      this.weights.shimmer * pShr +
      this.weights.hnr * pHNR +
      this.weights.scream * pG;

    // 3. Aplicar Gates (g1, g2, g3)
    // g1: VAD ou Grito
    const g1 = (features.vadScore > 0.25 || features.screamProb > 0.60) ? 1.0 : 0.15;
    
    // g2: Noise Gate (exp(-0.08 * max(0, Noise - (-45))))
    const noiseFloor = features.noiseFloor || -60;
    const g2 = Math.exp(-0.08 * Math.max(0, noiseFloor - (-45)));

    // g3: SNR Gate (clip(SNR/12, 0.25, 1))
    const snr = features.snr || 10;
    const g3 = this.clip(snr / 12, 0.25, 1);

    const S_t = g1 * g2 * g3 * S_star;

    // 4. Soma Total e Sigmoid
    const rawSum = this.bias + S_t + biometrics + historyAnomaly + context;
    const ira = this.sigmoid(rawSum);

    return {
      ira,
      components: { S_t, S_star, g1, g2, g3 },
      features: { pE, pDE, pF0, pDF0, pJit, pShr, pHNR, pG }
    };
  }
}

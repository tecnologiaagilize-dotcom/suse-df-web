/**
 * SensorContextService - Módulo de Contexto Físico para o IRA-SUSI
 * Captura dados de Acelerômetro, Giroscópio e GPS para enriquecer a análise de risco.
 */
class SensorContextService {
    constructor() {
        this.state = {
            acceleration: { x: 0, y: 0, z: 0 },
            rotation: { alpha: 0, beta: 0, gamma: 0 },
            speed: 0, // km/h
            isMoving: false, // > 5km/h
            impactDetected: false,
            lastImpactTime: 0
        };
        
        this.watchId = null;
        this.motionListener = null;
        
        // Configurações de Sensibilidade
        this.IMPACT_THRESHOLD = 15.0; // G-force (m/s²) para considerar impacto
        this.MOVEMENT_THRESHOLD = 5.0; // km/h
    }

    start() {
        if (typeof window === 'undefined') return;

        // 1. Monitorar Acelerômetro (DeviceMotion)
        if (window.DeviceMotionEvent) {
            this.motionListener = (event) => {
                const acc = event.accelerationIncludingGravity || event.acceleration;
                if (!acc) return;

                this.state.acceleration = {
                    x: acc.x || 0,
                    y: acc.y || 0,
                    z: acc.z || 0
                };

                // Calcular Magnitude do Vetor de Aceleração
                // |a| = sqrt(x² + y² + z²)
                const magnitude = Math.sqrt(
                    Math.pow(this.state.acceleration.x, 2) + 
                    Math.pow(this.state.acceleration.y, 2) + 
                    Math.pow(this.state.acceleration.z, 2)
                );

                // Detectar Impacto (Subtraindo gravidade ~9.8m/s²)
                const dynamicForce = Math.abs(magnitude - 9.8);
                
                // v3.1: Threshold aumentado para 25.0 (Colisão Real)
                // 15.0 detectava lombadas e freadas bruscas.
                // 25.0 ~ 2.5G é compatível com colisão leve a moderada.
                if (dynamicForce > 25.0) {
                    this.state.impactDetected = true;
                    this.state.lastImpactTime = Date.now();
                    
                    // Tenta prevenir o popup "Shake to Undo" removendo foco de inputs
                    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                        document.activeElement.blur();
                    }

                    console.warn("IRA-SUSI: Impacto Físico Detectado!", dynamicForce.toFixed(2));
                    
                    // Reset do flag de impacto após 2 segundos
                    setTimeout(() => {
                        this.state.impactDetected = false;
                    }, 2000);
                }
            };

            window.addEventListener('devicemotion', this.motionListener);
        } else {
            console.warn("SensorContext: DeviceMotionEvent não suportado neste dispositivo.");
        }

        // 2. Monitorar Velocidade (GPS)
        if (navigator.geolocation) {
            this.watchId = navigator.geolocation.watchPosition(
                (position) => {
                    // speed vem em m/s. Converter para km/h (* 3.6)
                    const speedKmh = (position.coords.speed || 0) * 3.6;
                    this.state.speed = speedKmh;
                    this.state.isMoving = speedKmh > this.MOVEMENT_THRESHOLD;
                },
                (err) => console.error("SensorContext: Erro GPS", err),
                { enableHighAccuracy: true, maximumAge: 1000 }
            );
        }
    }

    stop() {
        if (this.motionListener) {
            window.removeEventListener('devicemotion', this.motionListener);
        }
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
        }
    }

    getContext() {
        return { ...this.state };
    }
}

export default new SensorContextService();

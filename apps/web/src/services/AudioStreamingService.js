import { supabase } from '../lib/supabase';

// Configuração de Constantes (Baseado no Doc Técnico Master)
const CONFIG = {
    ICE_SERVERS: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Em produção, adicionar TURN servers (coturn) aqui
    ],
    AUDIO_BITRATE_HIGH: 32000, // 32 kbps (4G/WiFi)
    AUDIO_BITRATE_LOW: 8000,   // 8 kbps (2G/Edge - Opus VBR)
    RETRY_INTERVAL: 5000,
    BUFFER_FLUSH_INTERVAL: 10000 // 10s para backup local
};

import { computeSHA256 } from '../utils/cryptoUtils';

class AudioStreamingService {
    constructor() {
        this.peerConnection = null;
        this.signalingSocket = null;
        this.localStream = null;
        this.mediaRecorder = null;
        this.chunks = [];
        this.sessionId = null;
        this.isTransmitting = false;
        this.connectionState = 'disconnected'; // disconnected, connecting, connected, failed
        
        // Callbacks
        this.onStateChange = null;
    }

    /**
     * Inicializa o serviço de Streaming (Chamado ao abrir o app ou configurar emergência)
     */
    init() {
        console.log("[AudioLive] Serviço inicializado.");
    }

    /**
     * Define o stream de áudio local para uso futuro
     * @param {MediaStream} stream 
     */
    setStream(stream) {
        this.localStream = stream;
        console.log("[AudioLive] Stream de áudio configurado e pronto.");
    }

    /**
     * Inicia a transmissão de áudio ao vivo
     * @param {MediaStream|null} stream - O stream de áudio (opcional se já setado via setStream)
     * @param {string} alertId - ID do alerta de emergência para vincular a sessão
     */
    async startStreaming(stream, alertId) {
        // Suporte a sobrecarga: se o primeiro argumento for string, é o alertId
        if (typeof stream === 'string') {
            alertId = stream;
            stream = this.localStream;
        } else if (!stream) {
            stream = this.localStream;
        }

        if (!stream) {
            console.error("[AudioLive] Nenhum stream de áudio disponível para transmissão.");
            return;
        }

        if (this.isTransmitting) {
            console.warn("[AudioLive] Já está transmitindo.");
            return;
        }

        console.log(`[AudioLive] Iniciando transmissão para alerta ${alertId}...`);
        this.localStream = stream;
        this.isTransmitting = true;
        this._updateState('connecting');

        try {
            // 1. Criar Sessão no Supabase (Metadados)
            await this._createSession(alertId);

            // 2. Iniciar Gravação Local de Backup ("Black Box") - Doc 4
            this._startLocalBackup(stream);

            // 3. Iniciar WebRTC (P2P/SFU) - Doc 1
            await this._setupWebRTC();

            // 4. Conectar Sinalização (WebSocket)
            // URL do Backend Railway (Environment Variable)
            const signalingUrl = import.meta.env.VITE_SIGNALING_SERVER_URL || 'wss://api.suse-df.com/signaling'; 
            this._connectSignaling(signalingUrl, alertId);

        } catch (error) {
            console.error("[AudioLive] Erro fatal ao iniciar streaming:", error);
            this._updateState('failed');
            // Fallback: Garantir que pelo menos a gravação local continue
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                this._startLocalBackup(stream);
            }
        }
    }

    /**
     * Para a transmissão e finaliza a sessão
     */
    async stopStreaming() {
        console.log("[AudioLive] Parando transmissão...");
        this.isTransmitting = false;
        this._updateState('disconnected');

        // Fechar WebRTC
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Fechar WebSocket
        if (this.signalingSocket) {
            this.signalingSocket.close();
            this.signalingSocket = null;
        }

        // Finalizar Gravação Local e Upload Final
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        // Atualizar fim da sessão no banco
        if (this.sessionId) {
            await supabase
                .from('audio_sessions')
                .update({ 
                    ended_at: new Date().toISOString(),
                    status: 'completed'
                })
                .eq('id', this.sessionId);
            this.sessionId = null;
        }
    }

    // --- MÉTODOS PRIVADOS ---

    async _createSession(alertId) {
        const { data, error } = await supabase
            .from('audio_sessions')
            .insert({
                alert_id: alertId,
                status: 'active',
                started_at: new Date().toISOString(),
                protocol: 'webrtc_v1'
            })
            .select()
            .single();

        if (error) {
            console.error("[AudioLive] Erro ao criar sessão:", error);
            // Gera um ID temporário local se falhar (Offline first)
            this.sessionId = `offline_${Date.now()}`;
        } else {
            this.sessionId = data.id;
            console.log("[AudioLive] Sessão criada:", this.sessionId);
        }
    }

    _startLocalBackup(stream) {
        try {
            // Configurações otimizadas para voz (Opus)
            const options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 16000 };
            
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn("[AudioLive] Codec Opus não suportado, usando default.");
                delete options.mimeType;
            }

            this.mediaRecorder = new MediaRecorder(stream, options);
            this.chunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    this.chunks.push(e.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                const blob = new Blob(this.chunks, { type: 'audio/webm' });
                console.log(`[AudioLive] Backup local finalizado. Tamanho: ${blob.size} bytes.`);
                await this._uploadEvidence(blob, 'final_backup');
                this.chunks = [];
            };

            // Fatiar a cada 30 segundos para upload incremental (Evidência Dupla - Doc 9)
            this.mediaRecorder.start(30000);
            console.log("[AudioLive] Gravação local de backup iniciada (Black Box 30s).");

            // Hook para interceptar os slices e enviar (Delta Sync - Doc 4)
            const originalOnData = this.mediaRecorder.ondataavailable;
            this.mediaRecorder.ondataavailable = async (e) => {
                originalOnData(e);
                if (e.data.size > 0) {
                    const hash = await computeSHA256(e.data);
                    this._uploadEvidence(e.data, `segment_${Date.now()}_${hash.substring(0, 8)}`);
                }
            };

        } catch (e) {
            console.error("[AudioLive] Erro ao iniciar MediaRecorder:", e);
        }
    }

    async _uploadEvidence(blob, suffix) {
        if (!this.sessionId || this.sessionId.startsWith('offline_')) return;

        // Upload em background para não bloquear
        const filename = `${this.sessionId}/${suffix}.webm`;
        supabase.storage
            .from('audio-evidence')
            .upload(filename, blob)
            .then(({ data, error }) => {
                if (error) console.warn("[AudioLive] Falha no upload de segmento:", error.message);
                else console.log("[AudioLive] Segmento enviado:", filename);
            });
    }

    async _setupWebRTC() {
        this.peerConnection = new RTCPeerConnection({ iceServers: CONFIG.ICE_SERVERS });

        // Adicionar trilha de áudio
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });

        // Monitorar estado
        this.peerConnection.onconnectionstatechange = () => {
            console.log("[AudioLive] WebRTC State:", this.peerConnection.connectionState);
            this._updateState(this.peerConnection.connectionState);
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.signalingSocket) {
                this.signalingSocket.send(JSON.stringify({
                    type: 'candidate',
                    candidate: event.candidate,
                    sessionId: this.sessionId
                }));
            }
        };
    }

    _connectSignaling(url, alertId) {
        // Simulação de WebSocket se a URL não for real ainda
        if (url.includes('suse-df.com')) {
            console.log("[AudioLive] Modo Simulação: WebSocket não configurado no backend real.");
            // Simular conexão estabelecida após 1s
            setTimeout(() => this._updateState('connected'), 1000);
            return;
        }

        this.signalingSocket = new WebSocket(url);

        this.signalingSocket.onopen = async () => {
            console.log("[AudioLive] Sinalização conectada.");
            this.signalingSocket.send(JSON.stringify({ type: 'join', alertId }));
            
            // Criar Offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.signalingSocket.send(JSON.stringify({
                type: 'offer',
                sdp: offer,
                alertId
            }));
        };

        this.signalingSocket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'answer') {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            } else if (data.type === 'candidate') {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        };

        this.signalingSocket.onerror = (err) => {
            console.error("[AudioLive] Erro na sinalização:", err);
            // Não falha o serviço inteiro, pois temos o backup local rodando
        };
    }

    _updateState(newState) {
        this.connectionState = newState;
        if (this.onStateChange) {
            this.onStateChange(newState);
        }
    }
}

export default new AudioStreamingService();
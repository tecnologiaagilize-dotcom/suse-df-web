// Serviço de Gerenciamento de Áudio Live (WebRTC + Gravação Local)
import { supabase } from '../../lib/supabase';
import { io } from 'socket.io-client';

// URL do servidor de sinalização (Railway) - Configurada via variável de ambiente
const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL || 'https://suse-df-web-production.up.railway.app';

const SESSION_DURATION_MS = 45 * 60 * 1000; // 45 minutos

export class AudioLiveService {
    constructor(sosEventId) {
        this.sosEventId = sosEventId;
        this.mediaRecorder = null;
        this.chunks = [];
        this.stream = null;
        this.sessionId = null;
        this.sessionExpiresAt = null;
        this.intervalId = null;
        this.socket = null; // Socket.IO Client
    }

    // Iniciar sessão de áudio
    async startSession() {
        try {
            // 1. Obter permissão de microfone
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // 2. Criar ocorrência de áudio no backend (se não existir)
            const { data: occ, error: occErr } = await supabase
                .from('audio_occurrences')
                .insert({ sos_event_id: this.sosEventId, status: 'active' })
                .select()
                .single();
            
            if (occErr) throw occErr;

            // 3. Criar sessão de áudio inicial
            await this.createNewSession(occ.id);

            // 4. Iniciar gravação local (Client-side failover)
            this.startLocalRecording();

            // 5. Conectar ao Servidor de Sinalização (WebRTC)
            this.connectSignalingServer(occ.id);

            // 6. Configurar renovação automática (T-3min)
            this.setupRenewalCheck(occ.id);

            return { stream: this.stream, sessionId: this.sessionId };

        } catch (err) {
            console.error('Erro ao iniciar Audio Live:', err);
            throw err;
        }
    }

    connectSignalingServer(occurrenceId) {
        try {
            this.socket = io(SIGNALING_SERVER_URL, {
                transports: ['websocket'],
                query: {
                    occurrence_id: occurrenceId,
                    session_token: this.sessionId
                }
            });

            this.socket.on('connect', () => {
                console.log('Conectado ao servidor de sinalização:', this.socket.id);
                this.joinRoom(occurrenceId);
            });

            this.socket.on('disconnect', () => {
                console.warn('Desconectado do servidor de sinalização');
            });

            // Handlers para WebRTC (Offer, Answer, ICE) serão implementados aqui
            // ...

        } catch (error) {
            console.error("Erro ao conectar Socket.IO:", error);
        }
    }

    joinRoom(occurrenceId) {
        if (this.socket) {
            this.socket.emit('join_room', { 
                occurrence_id: occurrenceId,
                session_token: this.sessionId
            });
        }
    }

    async createNewSession(occurrenceId) {
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
        
        const { data: session, error } = await supabase
            .from('audio_sessions')
            .insert({
                occurrence_id: occurrenceId,
                session_token: this.generateSessionToken(), // Simulado por enquanto
                expires_at: expiresAt,
                is_active: true
            })
            .select()
            .single();

        if (error) throw error;
        
        this.sessionId = session.id;
        this.sessionExpiresAt = new Date(expiresAt);
        console.log(`Nova sessão de áudio iniciada: ${this.sessionId} (Expira em: ${this.sessionExpiresAt})`);
    }

    startLocalRecording() {
        if (!this.stream) return;

        // Codec Opus preferencialmente
        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
            ? { mimeType: 'audio/webm;codecs=opus' } 
            : {};

        this.mediaRecorder = new MediaRecorder(this.stream, options);

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.chunks.push(e.data);
                // Upload incremental (a cada X segundos ou tamanho Y) pode ser feito aqui
                this.uploadChunk(e.data);
            }
        };

        // Gravar em fatias de 10 segundos para upload frequente
        this.mediaRecorder.start(10000); 
    }

    async uploadChunk(blob) {
        if (!this.sessionId) return;
        
        // Simulação de upload para Storage
        const fileName = `${this.sessionId}/${Date.now()}.webm`;
        // const { error } = await supabase.storage.from('audio-evidence').upload(fileName, blob);
        
        // Registrar segmento no banco
        // await supabase.from('audio_segments').insert({ ... })
        console.log(`Upload de segmento: ${fileName} (${blob.size} bytes)`);
    }

    setupRenewalCheck(occurrenceId) {
        this.intervalId = setInterval(async () => {
            if (!this.sessionExpiresAt) return;
            
            const now = new Date();
            const timeLeft = this.sessionExpiresAt.getTime() - now.getTime();
            
            // Renovar se faltar menos de 3 minutos (180000ms)
            if (timeLeft < 180000) {
                console.log('Renovando sessão de áudio (Failsafe)...');
                await this.createNewSession(occurrenceId);
                // Reiniciar recorder para nova sessão se necessário
                this.mediaRecorder.stop();
                this.startLocalRecording();
            }
        }, 60000); // Checar a cada minuto
    }

    stopSession() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        if (this.socket) {
            this.socket.disconnect();
        }
        
        // Atualizar status no banco para closed
        // ...
        console.log('Sessão de áudio encerrada.');
    }

    generateSessionToken() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
}

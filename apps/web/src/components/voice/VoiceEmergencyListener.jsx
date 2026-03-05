import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext'; // Importar AuthContext
import { Mic, MicOff, Activity, ShieldCheck, WifiOff, Zap, Volume2 } from 'lucide-react';
import VoiceBiometryService from '../../services/VoiceBiometryService';
import RingBufferService from '../../services/RingBufferService';
import WakeWordService from '../../services/WakeWordService';
import VoiceActivityService from '../../services/VoiceActivityService';
import AudioFeatureExtractor from '../../services/AudioFeatureExtractor';
import IraSusiCore from '../../services/IraSusiCore';
import SensorContextService from '../../services/SensorContextService';
import AudioStreamingService from '../../services/AudioStreamingService';
import IraDebugPanel from '../debug/IraDebugPanel';
import stringSimilarity from 'string-similarity'; // Comparação fonética

// MÓDULO 10 - PATCH 4.5: Normalização de Frase (Consolidado)
const normalizePhrase = (text) => {
    if (!text) return '';
    return text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^\w\s]|_/g, "") // Remove pontuação
        .replace(/\s+/g, " ") // Colapsa espaços
        .trim();
};

export default function VoiceEmergencyListener({ 
    emergencyPhrase, 
    onEmergencyDetected, 
    isActive = true, 
    onTranscriptChange,
    onAnalysisUpdate, // Callback para expor dados do IRA-SUSI
    onStatusChange, // Callback para status do listener (listening, analyzing, error)
    showDebugPanel = true // Se true, mostra o painel flutuante interno
}) {
  const { user } = useAuth(); // Hook para acessar metadados do usuário
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false); // Novo estado VAD
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const [debugData, setDebugData] = useState(null); // Dados para o painel de calibração
  const [audioCoreReady, setAudioCoreReady] = useState(false); // Sequenciamento de inicialização

  const recognitionRef = useRef(null);
  const isAnalyzingRef = useRef(isAnalyzing);
  const analysisLoopRef = useRef(null); // Ref para o loop de análise IRA
  const isMountedRef = useRef(true);
  
  // AudioWorklet Refs
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);
  
  // Callback Refs (para evitar reinício do efeito)
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onAnalysisUpdateRef = useRef(onAnalysisUpdate);
  
  useEffect(() => {
      onTranscriptChangeRef.current = onTranscriptChange;
      onAnalysisUpdateRef.current = onAnalysisUpdate;
  }, [onTranscriptChange, onAnalysisUpdate]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // --- LÓGICA DE RING BUFFER E WORKLET ---
    useEffect(() => {
        // Inicializa o RingBuffer globalmente apenas uma vez se ainda não foi inicializado
        // RingBufferService é um singleton exportado com 'new', então já está instanciado.
        // Mas precisamos garantir que ele está "vivo" e recebendo dados.
        
        // Debug: Verificar se o RingBuffer está recebendo dados
        const debugInterval = setInterval(() => {
            if (isAnalyzingRef.current) return;
            // Apenas um check leve para ver se o ponteiro está movendo
            // console.log("RingBuffer Pointer:", RingBufferService.writePointer); 
        }, 5000);
        
        return () => clearInterval(debugInterval);
    }, []);

    // Inicializar AudioWorklet (Core v2) e Wake Word
    const initAudioCore = async () => {
        // --- SAFETY TIMEOUT: Garante que Web Speech inicie mesmo se Audio Core travar ---
        const safetyTimer = setTimeout(() => {
            if (!audioCoreReady) {
                console.warn("[VoiceEmergencyListener] Audio Core demorou muito. Forçando início do Web Speech API.");
                setAudioCoreReady(true);
            }
        }, 4000); // 4 segundos de tolerância

        try {
            // Garantir que o buffer esteja limpo antes de começar
            RingBufferService.clear();

            if (audioContextRef.current?.state === 'running') {
                 console.log("AudioContext já rodando. Ignorando re-init.");
                 clearTimeout(safetyTimer);
                 setAudioCoreReady(true);
                 return;
            }

          // 1. Inicializar Wake Word (TensorFlow.js)
          await WakeWordService.loadModel();
          WakeWordService.startListening((word) => {
              console.log("Wake Word Trigger:", word);
              handleWakeWordTrigger();
          });
          
              // 2. Inicializar VAD (Silero)
              // console.log("[VoiceEmergencyListener] Iniciando VAD..."); // REMOVIDO LOG EXCESSIVO
              await VoiceActivityService.start(
                  () => {
                      console.log("[VAD Trigger] Voz detectada! Ativando Web Speech...");
                      setIsSpeechDetected(true);
                      
                          // GATILHO VAD-FIRST: Inicia Web Speech temporariamente
                          if (recognitionRef.current && !isAnalyzingRef.current) {
                              try { 
                                  // Apenas tenta iniciar se não estiver ouvindo.
                                  // Se já estiver ouvindo, apenas renova o timestamp.
                                  if (!isListening) {
                                      console.log("Iniciando reconhecimento de fala...");
                                      recognitionRef.current.start();
                                  } else {
                                      // console.log("Reconhecimento já ativo. Renovando timestamp."); // REMOVIDO LOG EXCESSIVO
                                  }
                                  window.lastSpeechTimestamp = Date.now();
                                  
                                  // Watchdog Inteligente: Desliga se houver 10s de silêncio absoluto (AUMENTADO de 5s)
                                  if (window.silenceCheckInterval) clearInterval(window.silenceCheckInterval);
                                  window.silenceCheckInterval = setInterval(() => {
                                      if (!isListening) { clearInterval(window.silenceCheckInterval); return; }
                                      
                                      const timeSinceLastSpeech = Date.now() - (window.lastSpeechTimestamp || 0);
                                      // Janela estendida para 10 segundos
                                      if (timeSinceLastSpeech > 10000) {
                                          console.log("[VAD Timeout] Desligando Web Speech (10s sem fala).");
                                          if (recognitionRef.current) recognitionRef.current.stop();
                                          clearInterval(window.silenceCheckInterval);
                                      }
                                  }, 1000);
                                  
                              } catch(e) {
                                  // Se já estiver rodando, ignora
                                  console.warn("Erro ao iniciar WebSpeech no VAD Trigger:", e);
                              }
                          }
                  },  
                  () => {
                      // console.log("[VAD End] Silêncio detectado."); // REMOVIDO LOG EXCESSIVO
                      setIsSpeechDetected(false);
                  }
              );
          console.log("[VoiceEmergencyListener] VAD Iniciado.");

          // Listener removido daqui. Configurado no useEffect principal.

          setIsOfflineMode(true); 

          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioContext({ sampleRate: 16000 }); 
          audioContextRef.current = ctx;

          // ... (restante do código)

          // Cleanup removido de initAudioCore (deve ser gerenciado pelo useEffect)
          
          // --- FIX: Resume AudioContext se estiver suspenso (Autoplay Policy) ---
          if (ctx.state === 'suspended') {
              console.log("VoiceEmergencyListener: AudioContext suspenso, tentando retomar...");
              try {
                  await ctx.resume();
              } catch(e) {
                  console.warn("Autoplay bloqueado. Aguardando interação do usuário.");
              }
          }
          // ---------------------------------------------------------------------

          // Carregar módulo AudioWorklet com tratamento de erro
          try {
              await ctx.audioWorklet.addModule('/workers/suse-audio-processor.js');
              console.log("AudioWorklet: Módulo carregado com sucesso");
          } catch (e) {
              console.error("AudioWorklet: Falha crítica ao carregar módulo:", e);
              // Fallback ou retry?
              // Vamos deixar seguir pois o Meyda ainda pode funcionar sem o Worklet
          }

          // --- MELHORIA DE CAPTAÇÃO: Noise Suppression & Echo Cancellation ---
          // FIX: Usar um stream único se possível ou garantir que não conflite
          let stream;
          try {
              stream = await navigator.mediaDevices.getUserMedia({ 
                  audio: {
                      echoCancellation: true,
                      noiseSuppression: true,
                      autoGainControl: true,
                      channelCount: 1,
                      sampleRate: 16000
                  } 
              });

              // [AUDIO LIVE] Injetar stream no serviço de transmissão
              AudioStreamingService.setStream(stream);

          } catch (err) {
              console.error("Erro ao obter media stream:", err);
              setError("Erro ao acessar microfone: " + err.message);
              return;
          }
          
          streamRef.current = stream;
          const source = ctx.createMediaStreamSource(stream);

          // DIAGNÓSTICO: Monitorar fluxo de áudio na entrada
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          
          // Loop de verificação de sinal (só roda nos primeiros 5s)
          let silenceCheckCount = 0;
          const signalCheckInterval = setInterval(() => {
              analyser.getByteFrequencyData(dataArray);
              const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
              console.log(`[Mic Signal Check] Volume Médio: ${volume.toFixed(2)}`);
              
              if (volume > 10) {
                  console.log("[Mic Signal Check] Sinal OK detectado.");
                  clearInterval(signalCheckInterval);
              }
              
              silenceCheckCount++;
              if (silenceCheckCount > 10) clearInterval(signalCheckInterval); // Para após 10 checks (5s)
          }, 500);

          // Iniciar VAD com o stream já criado (se suportado pelo service) ou deixar o service gerenciar
          // O VoiceActivityService usa vad-web que pede seu próprio stream.
          // Isso pode causar conflito em mobile.
          // TODO: Refatorar VoiceActivityService para aceitar MediaStreamSource.
          // Por enquanto, vamos manter como está mas cientes do risco.

          // --- PIPELINE DE PROCESSAMENTO DE ÁUDIO (Igual ao VoiceConfig) ---
          // 1. Filtro High-Pass (Remove ruídos graves/rumble abaixo de 85Hz)
          const lowCutFilter = ctx.createBiquadFilter();
          lowCutFilter.type = 'highpass';
          lowCutFilter.frequency.value = 85;

          // 2. Compressor (Normaliza o volume e evita picos)
          const compressor = ctx.createDynamicsCompressor();
          compressor.threshold.value = -20;
          compressor.knee.value = 30;
          compressor.ratio.value = 12;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.25;

          // Conectar grafo: Source -> Filter -> Compressor
          source.connect(lowCutFilter);
          lowCutFilter.connect(compressor);
          
          const processedSource = compressor; // O sinal limpo sai daqui
          // ----------------------------------------------------------------

          // Inicializar Extrator de Features DSP (Meyda) com sinal PROCESSADO
          AudioFeatureExtractor.initialize(ctx, processedSource);
          SensorContextService.start();
          IraSusiCore.reset();
          
          // --- Robustez: Check de inicialização ---
          setTimeout(() => {
              if (!AudioFeatureExtractor.getFeatures()) {
                  console.warn("IRA-SUSI: AudioFeatureExtractor não retornou dados após 1s. Tentando reinicializar...");
                  AudioFeatureExtractor.initialize(ctx, processedSource);
              }
          }, 1000);

          // --- FIX: Resume AudioContext se estiver suspenso (Autoplay Policy) ---
          if (ctx.state === 'suspended') {
              console.log("VoiceEmergencyListener: AudioContext suspenso, tentando retomar...");
              await ctx.resume();
          }
          // ---------------------------------------------------------------------

          // --- Carregar Baseline Personalizado IRA-SUSI ---
          if (user?.user_metadata?.ira_baseline) {
              console.log("VoiceEmergencyListener: Carregando baseline personalizado do usuário.");
              IraSusiCore.setBaseline(user.user_metadata.ira_baseline);
              VoiceBiometryService.setBaseline(user.user_metadata.ira_baseline); // Injeta no serviço de biometria
          } else {
              console.log("VoiceEmergencyListener: Usando baseline padrão (não configurado).");
          }
          // -----------------------------------------------

          // Iniciar Loop de Análise IRA-SUSI
          const analyzeFrame = () => {
              if (!isActive) return;

              const features = AudioFeatureExtractor.getFeatures();
              const context = SensorContextService.getContext();

              if (features) {
                  const result = IraSusiCore.processFrame(features, 0, context);
                  const fullData = { ...result, features, context };
                  
                  // Atualiza callback externo (se houver) em tempo real
                  if (onAnalysisUpdateRef.current) onAnalysisUpdateRef.current(fullData);

                  // Atualiza dados de debug interno (com throttle para não matar a UI)
                  // FIX: Reduzido o throttle para 0.5 (50%) para ver atualizações mais frequentes
                  if (showDebugPanel && Math.random() > 0.5) {
                      setDebugData(fullData);
                  }

                  // Loop de Análise Contínua (Sem Frase)
                  // v3.1: Strict Compliance IRA v1.3
                  // Regra 1: "Impacto crítico + silêncio/grito -> Central"
                  const isCriticalImpact = context?.impactDetected; // ImpactFlag >= 0.85 (25m/s²)
                  const isStressDetected = result.ira > 0.70; // Stress/Grito (Base para fusão)
                  const isSilencePostImpact = isCriticalImpact && features.dbfs < -50; // Silêncio absoluto pós-batida
                  
                  // --- INOVAÇÃO IRA v1.3: Temporizador de Silêncio (NoResponseTimeout) ---
                  // Se detectarmos impacto crítico, iniciamos um contador de "silêncio sustentado".
                  // Apenas se o silêncio persistir por X segundos (ex: 5s) validamos o NoResponseTimeout.
                  
                  // Lógica de Estado Global para Timeout (via useRef para não re-renderizar)
                  if (isCriticalImpact) {
                      if (!window.iraImpactTimestamp) {
                          window.iraImpactTimestamp = Date.now();
                          console.log("IRA-SUSI: Impacto detectado. Iniciando cronômetro de resposta...");
                      }
                      
                      // Se houver voz normal (IRA baixo e volume normal), CANCELA o alerta
                      if (features.dbfs > -40 && result.ira < 0.5) {
                          if (window.iraImpactTimestamp) {
                              console.log("IRA-SUSI: Voz normal detectada pós-impacto. Cancelando alerta automático.");
                              window.iraImpactTimestamp = null; // Reset
                          }
                      }
                  }

                  // Verifica se passou o tempo de silêncio (ex: 5000ms)
                  const silenceDuration = window.iraImpactTimestamp ? Date.now() - window.iraImpactTimestamp : 0;
                  const isNoResponseTimeout = silenceDuration > 5000; 

                  // Regra 2: "Risco Extremo (IRA > 92%) -> Central" (Acoustic Only - Risk Bar > 70%)
                  // Conforme solicitado: "só ira realizar uma chamada automatica sem a frase de emergencia quando o marcardor 'Em risco' utltrapassar a metrica de 70%"
                  // Considerando Risk inicia em ~0.75, 70% da escala de risco nos leva a ~0.92.
                  const isExtremeAcousticRisk = result.ira > 0.92;

                  if (!isAnalyzingRef.current) {
                      // Nova Lógica de Fusão Tripla (Impacto + Silêncio Sustentado + Stress/Silêncio)
                      if (isCriticalImpact && isNoResponseTimeout && (isStressDetected || isSilencePostImpact)) {
                          const cause = isStressDetected ? "IMPACTO_CRITICO_COM_STRESS" : "IMPACTO_CRITICO_COM_SILENCIO_SUSTENTADO";
                          console.warn(`IRA-SUSI: Emergência Automática (Matriz Final v1.3). Motivo: ${cause}`);
                          if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
                          onEmergencyDetected(cause);
                          window.iraImpactTimestamp = null; // Reset após acionar
                      }
                      else if (isExtremeAcousticRisk) {
                          console.warn("IRA-SUSI: Emergência Automática (Risco Acústico Extremo > 92%). Motivo: Grito/Pânico Confirmado.");
                          if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
                          onEmergencyDetected("RISCO_ACUSTICO_EXTREMO");
                      }
                  }
              }
              analysisLoopRef.current = requestAnimationFrame(analyzeFrame);
          };
          analysisLoopRef.current = requestAnimationFrame(analyzeFrame);

          const workletNode = new AudioWorkletNode(ctx, 'suse-audio-processor');
          
          // Receber dados da thread separada
          workletNode.port.onmessage = (event) => {
              if (event.data.eventType === 'audio_data') {
                  const audioData = event.data.audioBuffer;
                  // Gravação contínua no RingBuffer (Prioridade Crítica)
                  RingBufferService.write(audioData);
                  
                  // Verificação de saúde do stream (Detecta silêncio digital ou falha de hardware)
                  if (Math.random() > 0.99) { // Amostragem ~1% para não floodar
                      const rms = Math.sqrt(audioData.reduce((acc, val) => acc + val * val, 0) / audioData.length);
                      if (rms < 0.0001) {
                          console.warn("[IRA-SUSI Health] Alerta: Entrada de áudio muito baixa ou muda (Silêncio Digital). Verifique o microfone.");
                      }
                  }
              }
          };

          // Conectar sinal PROCESSADO ao Worklet (RingBuffer e VAD)
          processedSource.connect(workletNode);
          workletNode.connect(ctx.destination); 
          
          // DIAGNÓSTICO WORKLET: Verificar se o processador está vivo
          workletNode.onprocessorerror = (err) => {
              console.error("[AudioWorklet] Erro no processador:", err);
              setError("Erro crítico no processamento de áudio.");
          }; 
          
          workletNodeRef.current = workletNode;
          console.log("Audio Core v2 (Worklet + WakeWord + VAD + IRA-SUSI) iniciado.");
          clearTimeout(safetyTimer); // Cancela timeout se sucesso
          setAudioCoreReady(true); // Libera SpeechRecognition

      } catch (err) {
          console.error("Falha ao iniciar Audio Core v2:", err);
          setError("Erro no módulo de áudio: " + err.message);
          clearTimeout(safetyTimer); // Cancela timeout se erro tratado
          setAudioCoreReady(true); // Libera SpeechRecognition mesmo com erro no Core (Fallback)
      }
  };

  const stopAudioCore = async () => {
      console.log("[IRA-SUSI Shutdown] Iniciando sequência de desligamento seguro (Mod 10.4.3)...");

      // 0. Stop Recognizer (Prioridade 0)
      if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch(e){}
      }

      // 1. Parar Worker/Services
      WakeWordService.stopListening();
      VoiceActivityService.stop(); // Parar VAD
      AudioFeatureExtractor.stop(); // Parar Meyda
      SensorContextService.stop(); // Parar Sensores
      if (analysisLoopRef.current) cancelAnimationFrame(analysisLoopRef.current);
      
      setIsOfflineMode(false);

      // 2. Desconectar Nós
      if (workletNodeRef.current) {
          workletNodeRef.current.disconnect();
          workletNodeRef.current = null;
      }

      // 3. Parar Tracks (Hardware)
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }

      // 4. Fechar AudioContext
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          try {
            await audioContextRef.current.close();
          } catch(e) { console.warn("Erro ao fechar AudioContext:", e); }
          audioContextRef.current = null;
      }
      
      // 5. Reset UI State (Garantia)
      if (isMountedRef.current) {
          setIsListening(false);
          setIsAnalyzing(false);
      }

      console.log("[IRA-SUSI Shutdown] Sequência concluída.");
  };

  // Handler unificado para detecção (Wake Word ou Web Speech)
  const handleWakeWordTrigger = async () => {
      if (isAnalyzingRef.current) return;

      console.log("Acionamento por Voz (Wake Word ou Frase) Detectado!");
      
      // Pausa reconhecimento Web Speech se estiver rodando
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
      
      setIsAnalyzing(true);
      isAnalyzingRef.current = true;

      // Recupera áudio do Ring Buffer (últimos 5 segundos)
      const audioBlob = RingBufferService.getWavBlob(5);
      
      if (audioBlob.size < 1000) {
                  console.warn("Buffer de áudio vazio. Acionando fallback.");
                  onEmergencyDetected("FALHA_BUFFER_AUDIO");
                  setIsAnalyzing(false);
                  isAnalyzingRef.current = false;
                  return;
              }

              // Verifica Biometria
              // ---------------------------------------------------------------------

              // Obter features atuais para comparação local
              const currentFeatures = AudioFeatureExtractor.getFeatures();
              const iraRiskLevel = IraSusiCore.getRiskLevel(); // 0 a 1

              // Tentar verificação local primeiro (mais rápida e garante funcionamento offline)
            const localBiometry = VoiceBiometryService.verifySpeakerIdentityLocal(currentFeatures);
            
            // Decisão Tripla: (Texto + Biometria Local + IRA Risk)
            // Se Biometria Local OK -> Aciona
            // Se Biometria Local Falha mas IRA Risk Alto -> Aciona (Contexto de Pânico altera a voz)
            
            let biometryVerified = localBiometry.isVerified;
            
            if (!biometryVerified && iraRiskLevel > 0.6) {
                console.warn("Biometria Local Falhou (Z-Score alto), mas IRA Risk é ALTO. Voz alterada por stress?");
                // Se o risco é alto, relaxamos o threshold biométrico
                if (localBiometry.distance < 4.0) { // Aceita até 4 sigmas se estiver em pânico
                     console.log("Aceitando biometria degradada devido ao Risco IRA.");
                     biometryVerified = true;
                }
            }

            // --- STRICT MODE BYPASS FOR EXACT SEMANTIC MATCH (v1.3.31) ---
            // Se a frase foi dita com 100% de precisão (ou > 95%), confiamos que é o usuário,
            // pois a frase é um segredo (Secret Word). Biometria serve para evitar spoofing em frases comuns,
            // mas em uma frase secreta exata, o risco de falso negativo (não salvar a vítima) supera o risco de falso positivo.
            if (!biometryVerified && similarity >= 0.95) {
                console.warn(`[IRA-SUSI] Semantic Match Extremo (${(similarity*100).toFixed(1)}%). Bypass de Biometria ativado para garantir socorro.`);
                biometryVerified = true;
            }
            // -----------------------------------------------------------

              if (biometryVerified) {
                   console.log("Biometria Local Confirmada (IRA-Match). ACIONANDO EMERGÊNCIA.");
                   onEmergencyDetected("COMANDO_VOZ_BIOMETRIA_LOCAL");
                   return; // Sai cedo, sucesso
              }

              // Se local falhou, tenta remoto (se houver internet/backend)
              try {
                const result = await VoiceBiometryService.verifySpeakerIdentity(audioBlob);
                
                // STRICT MODE v1.1: Apenas Biometria Verificada Aciona.
                // Sem "Fail-Open", sem "Backend Offline".
                if (result && result.isVerified) {
                    console.log("Biometria Confirmada (Wake Word). ACIONANDO.");
                    onEmergencyDetected("COMANDO_VOZ_BIOMETRIA_CONFIRMADA");
                } else {
                  console.warn("Biometria Falhou ou Backend Offline. IGNORADO (Strict Mode).");
                  // Não aciona.
              }
            } catch (err) {
                console.error("Erro na verificação biométrica:", err);
                // Strict Mode: Erro técnico = Não aciona.
            } finally {
          // Garante que a UI destrave
          setTimeout(() => {
              if (isMountedRef.current) {
                setIsAnalyzing(false);
                isAnalyzingRef.current = false;
              }
          }, 3000);
      }
  }; // Closes handleWakeWordTrigger

  // MÓDULO 10 - PATCH 4.2: Watchdogs (Transcrição 12s)
  // FIX: Movido para fora de initAudioCore para respeitar Regras de Hooks
  useEffect(() => {
      if (!isListening || isAnalyzing) return;

      const watchdogTimer = setTimeout(() => {
          // Se não houver transcrição nova por 12s, reinicia
          if (recognitionRef.current && isListening) {
              console.warn("[IRA-SUSI Watchdog] 12s sem transcrição. Reiniciando reconhecimento...");
              try {
                  recognitionRef.current.stop();
                  // O onend cuidará do reinício
              } catch(e) { console.error("Erro no watchdog:", e); }
          }
      }, 12000);

      return () => clearTimeout(watchdogTimer);
  }, [transcript, isListening, isAnalyzing]);

    const handleVoiceAnalysisResult = (event) => {
        const result = event.detail;
        console.log("[VoiceEmergencyListener] Resultado Recebido do Backend:", result);
        
        if (result && result.semantic_analysis) {
            const { match_percentage, risk_level, transcription } = result.semantic_analysis;
            
            // Debug visível na tela (Toast temporário)
            if (showDebugPanel) {
                // Se quiser forçar um log visual
                console.log(`[UI] Texto: ${transcription} | Risco: ${risk_level} (${match_percentage}%)`);
            }

            // Atualizar UI com dados reais do backend
            if (onAnalysisUpdateRef.current) {
                onAnalysisUpdateRef.current({
                    voiceDebug: {
                        text: transcription || result.transcription,
                        target: "Análise Semântica AI",
                        similarity: match_percentage / 100, // Normalizar 0-1
                        match: risk_level === 'CRÍTICO',
                        timestamp: Date.now(),
                        riskLevel: risk_level
                    }
                });
            }

            // Atualizar transcrição visível
            if (onTranscriptChangeRef.current && (transcription || result.transcription)) {
                onTranscriptChangeRef.current((transcription || result.transcription).slice(-100));
            }

            // Disparar Emergência se Risco Crítico
            if (risk_level === 'CRÍTICO' || match_percentage > 80) {
                 console.warn("🚨 Risco Crítico Detectado via Backend AI! Acionando...");
                 onEmergencyDetected("RISCO_SEMANTICO_BACKEND");
            }
        }
    };

    // Hook para inicializar/parar baseado em isActive e registrar listener
    useEffect(() => {
        if (isActive) {
            setAudioCoreReady(false); // Reset flag
            initAudioCore();
            window.addEventListener('voice-analysis-result', handleVoiceAnalysisResult);
        } else {
            stopAudioCore();
            window.removeEventListener('voice-analysis-result', handleVoiceAnalysisResult);
        }

        return () => {
            window.removeEventListener('voice-analysis-result', handleVoiceAnalysisResult);
            stopAudioCore();
        };
    }, [isActive]);

  // Notificar pai sobre mudanças de status
  useEffect(() => {
      if (onStatusChange) {
          onStatusChange({
              isListening,
              isAnalyzing,
              error
          });
      }
  }, [isListening, isAnalyzing, error, onStatusChange]);

  // Sync ref with state
  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  // CORREÇÃO 1: Reiniciar reconhecimento automaticamente quando a análise terminar
  useEffect(() => {
    // Executa apenas se parou de analisar, está ativo e não está ouvindo
    if (!isAnalyzing && isActive && recognitionRef.current && !isListening) {
      const timer = setTimeout(() => {
          try {
             // Tenta iniciar se ainda estivermos no estado correto
             if (!isAnalyzingRef.current && recognitionRef.current) {
                // recognitionRef.current.start(); // --- DESATIVADO PARA TESTE DE CONFLITO ---
                console.log("[Voice] Reinício automático bloqueado (Modo Teste v1.3.38)");
             }
          } catch (e) {
             // Ignora erro se já estiver rodando
          }
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyzing, isActive]); // Não incluímos isListening para evitar conflito com onend

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Seu navegador não suporta reconhecimento de voz.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';
    
    recognitionRef.current = recognition;

    recognition.onresult = async (event) => {
      // Atualiza timestamp da última atividade de fala
      window.lastSpeechTimestamp = Date.now();
      setIsSpeechDetected(true);
      
      if (isAnalyzingRef.current) return;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        // Feedback Visual Imediato (Mesmo se for Interim)
        setTranscript(transcript);

        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          // Confirmação final
          setTranscript(prev => {
             const newText = (prev + ' ' + transcript).trim().slice(-200); 
             if (onTranscriptChangeRef.current) onTranscriptChangeRef.current(normalizePhrase(newText));
             checkEmergencyPhrase(newText);
             return newText;
          });
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Checagem rápida no interim também
      if (interimTranscript) {
          // --- CORREÇÃO: Usar callback funcional para garantir estado atualizado ---
          setTranscript(prev => {
              const fullText = prev + ' ' + interimTranscript;
              // MÓDULO 10: Normalização Estrita
              const normalizedFullText = normalizePhrase(fullText);
              
              // --- FIX: Forçar atualização visual IMEDIATA ---
              if (onTranscriptChangeRef.current) onTranscriptChangeRef.current(normalizedFullText.trim().slice(-100));
              checkEmergencyPhrase(fullText);
              return prev; // Não salva interim no estado persistente, apenas usa
          });
      }
    };

    const checkEmergencyPhrase = async (text) => {
         if (!emergencyPhrase) return;
         
         // MÓDULO 10: Normalização Estrita
         const normalizedText = normalizePhrase(text);
         const normalizedPhrase = normalizePhrase(emergencyPhrase);

         // Debug Visual no Console (Requisitado: Monitoramento Avançado)
         console.log(`[IRA-SUSI AI Monitor] Analisando padrão de voz: "${normalizedText}" | Target: "${normalizedPhrase}"`);

         let match = false;
         let similarity = 0;
         
         // 1. Exact Match (Alta Precisão)
         const isExactMatch = normalizedText.includes(normalizedPhrase);

         if (isExactMatch) {
             match = true;
             similarity = 1.0;
         } else {
             // 2. Fuzzy Logic (Rede Neural Simulada via String Similarity)
             const words = normalizedText.split(' ');
             const phraseLength = normalizedPhrase.split(' ').length;
             
             if (words.length >= phraseLength) {
                 const recentPhrase = words.slice(-phraseLength).join(' ');
                 similarity = stringSimilarity.compareTwoStrings(recentPhrase, normalizedPhrase);
                 
                 console.log(`[IRA-SUSI AI Monitor] Similaridade Semântica: ${similarity.toFixed(4)}`);
                 
                 // Mantém o limiar de alta confiança (0.85) para evitar falsos positivos em escala
                 if (similarity >= 0.85) { 
                     match = true;
                 }
             }
         }

         // --- EXPORTAR DADOS DE DEBUG PARA UI (v2.0) ---
         // Envia dados para o componente pai exibir visualmente
         if (onAnalysisUpdateRef.current) {
             onAnalysisUpdateRef.current({
                 voiceDebug: {
                     text: normalizedText.slice(-50), // Últimos caracteres
                     target: normalizedPhrase,
                     similarity: similarity,
                     match: match,
                     timestamp: Date.now()
                 }
             });
         }
         
         // Reportar Texto para UI Principal (Redundância para garantir exibição)
         if (onTranscriptChangeRef.current) onTranscriptChangeRef.current(normalizedText.slice(-100));

         if (match) {
            console.log("!!! PADRÃO DE EMERGÊNCIA DETECTADO (MATCH 100%) !!!");
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            
            // Pausa reconhecimento para processamento exclusivo
            try { recognition.stop(); } catch(e){}
            setIsAnalyzing(true);
            isAnalyzingRef.current = true;

            // --- LÓGICA DE OURO v1.3.32 (Mandatory Trigger) ---
            // Se a frase foi reconhecida pela Análise Semântica (match=true),
            // isso significa que passou pelos filtros de similaridade e fuzzy logic.
            // Neste caso, a POSSE DA SENHA VERBAL é autenticação suficiente.
            // A biometria é coletada apenas para AUDITORIA, não para BLOQUEIO.
            
            console.log(`[IRA-SUSI] Acionamento Obrigatório por Match Semântico. Similaridade: ${(similarity*100).toFixed(1)}%`);
            
            // Disparo Imediato
            onEmergencyDetected("COMANDO_VOZ_MATCH_OBRIGATORIO");

            // Processamento Assíncrono de Evidência (Não bloqueante)
            setTimeout(async () => {
                try {
                    // Captura snapshot apenas para salvar evidência no backend
                    const audioBlob = RingBufferService.getWavBlob(5);
                    const currentFeatures = AudioFeatureExtractor.getFeatures();
                    
                    // Tenta validar biometria apenas para log
                    const localBiometry = VoiceBiometryService.verifySpeakerIdentityLocal(currentFeatures);
                    console.log("[IRA-SUSI Auditoria] Resultado Biometria Pós-Acionamento:", localBiometry);
                    
                    // Se quiser enviar para o backend, faria aqui, mas o onEmergencyDetected já iniciou o fluxo de alerta.
                } catch (e) {
                    console.error("[IRA-SUSI Auditoria] Erro ao processar evidência pós-acionamento:", e);
                } finally {
                    if (isMountedRef.current) { 
                        setIsAnalyzing(false); 
                        isAnalyzingRef.current = false; 
                    }
                }
            }, 100); // Pequeno delay para liberar a thread de UI do acionamento
            
            return;
         }
    };

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
      window.lastSpeechTimestamp = Date.now();

      // Watchdog de Silêncio (Desliga se ficar 5s sem detectar fala)
      const silenceInterval = setInterval(() => {
          if (!isMountedRef.current || !recognitionRef.current) {
              clearInterval(silenceInterval);
              return;
          }
          
          const timeSinceLastSpeech = Date.now() - (window.lastSpeechTimestamp || 0);
          if (timeSinceLastSpeech > 5000) {
               console.log("[VAD Timeout] Desligando Web Speech (5s sem fala).");
               try { recognitionRef.current.stop(); } catch(e){}
               clearInterval(silenceInterval);
          }
      }, 1000);
    };

    recognition.onend = () => {
      // VAD-FIRST: Não reinicia automaticamente. Espera o próximo trigger do VAD.
      if (isListening) {
          console.log("[Web Speech] Sessão encerrada (Silêncio ou Timeout).");
          setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setError('Permissão de microfone negada.');
        setIsListening(false);
      } else if (event.error === 'network') {
         // Silent retry for network errors
         setTimeout(() => {
             if (isActive && !isAnalyzingRef.current) {
                 try { recognition.start(); } catch(e){}
             }
         }, 5000);
      } else {
          console.warn("Erro reconhecimento:", event.error);
      }
    };

    if (isActive) {
      // Sequenciamento: Só inicia WebSpeech após VAD disparar (VAD-FIRST Architecture)
      // Removemos o start automático contínuo
      if (audioCoreReady) {
          console.log("[Voice] Audio Core Ativo. Aguardando VAD para iniciar Web Speech...");
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
    // --- FIX: Adicionar onTranscriptChange nas dependências para evitar stale closure ---
  }, [isActive, emergencyPhrase, onEmergencyDetected, audioCoreReady]); // Removed onTranscriptChange/onAnalysisUpdate to prevent restart loop

  if (error) {
    return <div className="text-xs text-red-500 mt-2 bg-red-50 p-1 rounded border border-red-200">{error}</div>;
  }

  return (
    <div className={`flex items-center space-x-2 text-sm p-2 rounded-full transition-all duration-300 ${
        isAnalyzing ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
        isListening ? 'bg-green-100 text-green-800 border border-green-200' : 
        'bg-gray-100 text-gray-500'
    }`}>
      {isAnalyzing ? <ShieldCheck className="w-4 h-4 animate-bounce" /> : 
       isListening ? <Mic className="w-4 h-4 animate-pulse text-green-600" /> : <MicOff className="w-4 h-4" />}
      
      <div className="flex flex-col leading-tight">
          <span className="font-medium">
            {isAnalyzing ? 'Processando Áudio...' : isListening ? 'Monitoramento Ativo' : 'Voz Inativa'}
          </span>
          {/* Feedback Visual Extra: Estado do Processamento */}
          {isListening && !isAnalyzing && (
              <span className="text-[10px] text-gray-500 font-mono">
                  {isSpeechDetected ? 'Detectando Fala (VAD)...' : 'Modo Acústico (Sem Transcrição)...'}
              </span>
          )}
      </div>
      
      {/* Painel de Calibração IRA-SUSI (Opcional) */}
      {showDebugPanel && <IraDebugPanel data={debugData} />}
    </div>
  );
}

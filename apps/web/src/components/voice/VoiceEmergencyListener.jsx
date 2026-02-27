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
import IraDebugPanel from '../debug/IraDebugPanel';
import stringSimilarity from 'string-similarity'; // Comparação fonética

export default function VoiceEmergencyListener({ 
    emergencyPhrase, 
    onEmergencyDetected, 
    isActive = true, 
    onTranscriptChange,
    onAnalysisUpdate, // Callback para expor dados do IRA-SUSI
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

  const recognitionRef = useRef(null);
  const isAnalyzingRef = useRef(isAnalyzing);
  const analysisLoopRef = useRef(null); // Ref para o loop de análise IRA
  const isMountedRef = useRef(true);
  
  // AudioWorklet Refs
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);

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
        try {
            if (audioContextRef.current?.state === 'running') {
                 console.log("AudioContext já rodando. Ignorando re-init.");
                 return;
            }

          // 1. Inicializar Wake Word (TensorFlow.js)
          await WakeWordService.loadModel();
          WakeWordService.startListening((word) => {
              console.log("Wake Word Trigger:", word);
              handleWakeWordTrigger();
          });
          
          // 2. Inicializar VAD (Silero)
          await VoiceActivityService.start(
              () => setIsSpeechDetected(true),  // On Start
              () => setIsSpeechDetected(false)  // On End
          );

          setIsOfflineMode(true); 

          const AudioContext = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioContext({ sampleRate: 16000 }); 
          audioContextRef.current = ctx;

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
          } catch (err) {
              console.error("Erro ao obter media stream:", err);
              setError("Erro ao acessar microfone: " + err.message);
              return;
          }
          
          streamRef.current = stream;
          const source = ctx.createMediaStreamSource(stream);

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
                  if (onAnalysisUpdate) onAnalysisUpdate(fullData);

                  // Atualiza dados de debug interno (com throttle para não matar a UI)
                  // FIX: Reduzido o throttle para 0.5 (50%) para ver atualizações mais frequentes
                  if (showDebugPanel && Math.random() > 0.5) {
                      setDebugData(fullData);
                  }

                  // Loop de Análise Contínua (Sem Frase)
                  // v3.0: Strict Compliance IRA v1.2
                  // Regra 1: "Impacto crítico + silêncio/grito -> Central"
                  const isCriticalImpact = context?.impactDetected; // ImpactFlag >= 0.85 (25m/s²)
                  const isStressDetected = result.ira > 0.70; // Stress/Grito (Base para fusão)
                  const isSilencePostImpact = isCriticalImpact && features.dbfs < -50; // Silêncio absoluto pós-batida
                  
                  // Regra 2: "Risco Extremo (IRA > 92%) -> Central" (Acoustic Only - Risk Bar > 70%)
                  // Conforme solicitado: "só ira realizar uma chamada automatica sem a frase de emergencia quando o marcardor 'Em risco' utltrapassar a metrica de 70%"
                  // Considerando Risk inicia em ~0.75, 70% da escala de risco nos leva a ~0.92.
                  const isExtremeAcousticRisk = result.ira > 0.92;

                  if (!isAnalyzingRef.current) {
                      if (isCriticalImpact && (isStressDetected || isSilencePostImpact)) {
                          const cause = isStressDetected ? "IMPACTO_CRITICO_COM_STRESS" : "IMPACTO_CRITICO_COM_SILENCIO";
                          console.warn(`IRA-SUSI: Emergência Automática (Matriz Final). Motivo: ${cause}`);
                          if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
                          onEmergencyDetected(cause);
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
                  RingBufferService.write(event.data.audioBuffer);
              }
          };

          // Conectar sinal PROCESSADO ao Worklet (RingBuffer e VAD)
          processedSource.connect(workletNode);
          workletNode.connect(ctx.destination); 
          
          workletNodeRef.current = workletNode;
          console.log("Audio Core v2 (Worklet + WakeWord + VAD + IRA-SUSI) iniciado.");

      } catch (err) {
          console.error("Falha ao iniciar Audio Core v2:", err);
          setError("Erro no módulo de áudio: " + err.message);
      }
  };

  const stopAudioCore = () => {
      WakeWordService.stopListening();
      VoiceActivityService.stop(); // Parar VAD
      AudioFeatureExtractor.stop(); // Parar Meyda
      SensorContextService.stop(); // Parar Sensores
      if (analysisLoopRef.current) cancelAnimationFrame(analysisLoopRef.current);
      
      setIsOfflineMode(false);

      if (workletNodeRef.current) {
          workletNodeRef.current.disconnect();
          workletNodeRef.current = null;
      }
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
      if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
      }
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
  };

  // Gerenciamento do Ciclo de Vida
  useEffect(() => {
    if (isActive) {
        initAudioCore();
    } else {
        stopAudioCore();
    }

    return () => {
        stopAudioCore();
    };
  }, [isActive]);

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
                recognitionRef.current.start();
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
      if (isAnalyzingRef.current) return; // Ignora se já estiver analisando

      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setTranscript(prev => {
              const newText = (prev + ' ' + transcriptSegment).trim().slice(-200); // Mantém contexto
              checkEmergencyPhrase(newText);
              return newText;
          });
        } else {
          interimTranscript += transcriptSegment;
        }
      }
      
      // Checagem rápida no interim também
      if (interimTranscript) {
          checkEmergencyPhrase(transcript + ' ' + interimTranscript);
      }
    };

    const checkEmergencyPhrase = async (text) => {
         if (!emergencyPhrase) return;
         
         const normalizedText = text.toLowerCase();
         const normalizedPhrase = emergencyPhrase.toLowerCase();

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
         if (onAnalysisUpdate) {
             onAnalysisUpdate((prev) => ({
                 ...prev,
                 voiceDebug: {
                     text: normalizedText.slice(-50), // Últimos caracteres
                     target: normalizedPhrase,
                     similarity: similarity,
                     match: match,
                     timestamp: Date.now()
                 }
             }));
         }

         if (match) {
            console.log("!!! PADRÃO DE EMERGÊNCIA DETECTADO !!! Iniciando protocolo de validação biométrica...");
            if (navigator.vibrate) navigator.vibrate(50);
            
            // Pausa reconhecimento para processamento exclusivo
            try { recognition.stop(); } catch(e){}
            setIsAnalyzing(true);
            isAnalyzingRef.current = true;

            // Captura snapshot de áudio para análise espectral e biométrica
            const audioBlob = RingBufferService.getWavBlob(5); 
            
            // Debug do Buffer (Apenas informativo, sem fallback inseguro)
            console.log(`[IRA-SUSI AI Monitor] Snapshot de Áudio: ${audioBlob.size} bytes. Enviando para análise.`);

            // O sistema segue para a verificação biométrica rigorosa (sem atalhos)
            // Se o áudio estiver vazio ou inválido, a biometria falhará naturalmente (Fail-Secure),
            // mantendo a robustez do sistema em escala.

            // ---------------------------------------------------------------------
            // Verifica Biometria (Local + Remote)

            // Obter features atuais para comparação local
            const currentFeatures = AudioFeatureExtractor.getFeatures();
            const iraRiskLevel = IraSusiCore.getRiskLevel(); // 0 a 1

            // Tentar verificação local primeiro (mais rápida e garante funcionamento offline)
            const localBiometry = VoiceBiometryService.verifySpeakerIdentityLocal(currentFeatures);
            
            // Decisão Tripla: (Texto + Biometria Local + IRA Risk)
            let biometryVerified = localBiometry.isVerified;
            
            if (!biometryVerified && iraRiskLevel > 0.6) {
                console.warn("Biometria Local Falhou (Z-Score alto), mas IRA Risk é ALTO. Voz alterada por stress?");
                // Se o risco é alto, relaxamos o threshold biométrico
                if (localBiometry.distance < 4.0) { // Aceita até 4 sigmas se estiver em pânico
                     console.log("Aceitando biometria degradada devido ao Risco IRA.");
                     biometryVerified = true;
                }
            }

            if (biometryVerified) {
                 console.log("Biometria Local Confirmada (IRA-Match). ACIONANDO EMERGÊNCIA.");
                 onEmergencyDetected("COMANDO_VOZ_BIOMETRIA_LOCAL");
                 
                 // Cleanup
                 setTimeout(() => { if (isMountedRef.current) { setIsAnalyzing(false); isAnalyzingRef.current = false; } }, 3000);
                 return;
            }

            // Fallback para Remoto (se local falhou e não temos certeza)
            try {
                const result = await VoiceBiometryService.verifySpeakerIdentity(audioBlob);
                
                // LÓGICA DE DECISÃO STRICT v1.1 (Zero Falso Positivo)
                
                // 1. Biometria VERIFICADA -> ACIONA
                if (result && result.isVerified) {
                    console.log("Biometria Verificada. ACIONANDO EMERGÊNCIA.");
                    onEmergencyDetected("COMANDO_VOZ_BIOMETRIA_CONFIRMADA");
                } 
                
                // 2. Biometria FALHOU -> IGNORA
                else {
                    console.warn("Biometria Falhou. IGNORADO (Strict Mode).");
                    // Nenhuma lógica de "Anti-Falso Negativo" permitida.
                }
            } catch (err) {
                console.error("Erro técnico biometria:", err);
                // Strict Mode: Erro = Ignora.
            } finally {
                setTimeout(() => {
                    if (isMountedRef.current) {
                        setIsAnalyzing(false);
                        isAnalyzingRef.current = false;
                    }
                }, 3000);
            }
         }
    };

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
    };

    recognition.onend = () => {
      setIsListening(false);
      
      // CORREÇÃO 2: Verificação robusta de instância para evitar stale closures
      if (isActive && recognitionRef.current === recognition && !isAnalyzingRef.current) {
         // Backoff para evitar loop infinito rápido
         setTimeout(() => {
             try {
                // Checa novamente dentro do timeout se a instância ainda é válida
                if (isActive && recognitionRef.current === recognition && !isAnalyzingRef.current) {
                    recognition.start();
                }
             } catch (e) {
                console.warn("Erro ao reiniciar reconhecimento:", e);
             }
         }, 1000); 
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
      try {
        recognition.start();
      } catch (e) {
        console.error(e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
    // --- FIX: Adicionar onAnalysisUpdate nas dependências para evitar stale closure ---
  }, [isActive, emergencyPhrase, onEmergencyDetected, onAnalysisUpdate]);

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
       isListening ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
      
      <div className="flex flex-col leading-tight">
          <span className="font-medium">
            {isAnalyzing ? 'Validando Biometria...' : isListening ? 'Monitoramento Ativo' : 'Voz Inativa'}
          </span>
      </div>
      
      {/* Painel de Calibração IRA-SUSI (Opcional) */}
      {showDebugPanel && <IraDebugPanel data={debugData} />}
    </div>
  );
}

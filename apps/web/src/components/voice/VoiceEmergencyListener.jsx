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

  // Inicializar AudioWorklet (Core v2) e Wake Word
  const initAudioCore = async () => {
      try {
          if (audioContextRef.current?.state === 'running') return;

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

          // Carregar módulo
          await ctx.audioWorklet.addModule('/workers/suse-audio-processor.js');

          // --- MELHORIA DE CAPTAÇÃO: Noise Suppression & Echo Cancellation ---
          const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                  channelCount: 1,
                  sampleRate: 16000
              } 
          });
          streamRef.current = stream;
          const source = ctx.createMediaStreamSource(stream);

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

                  // Se o score IRA for muito alto (Grito/Explosão), aciona emergência
                  // v1.6: Reativado com Validação de IA (MFCC Distância)
                  // O som deve ser persistente E ter características humanas compatíveis com o usuário
                  if (result.status === 'EMERGENCIA' && !isAnalyzingRef.current) {
                      console.warn("IRA-SUSI: Emergência Acústica Detectada! Score:", result.ira);
                      
                      // Pausa reconhecimento para análise
                      try { recognition.stop(); } catch(e){}
                      setIsAnalyzing(true);
                      isAnalyzingRef.current = true;

                      const audioBlob = RingBufferService.getWavBlob(5);
                      
                      // Análise Assíncrona de IA
                      VoiceBiometryService.analyzeEmergencyEvent(audioBlob, result.ira)
                        .then(isValid => {
                            if (isValid) {
                                console.warn("IA Validou Evento Acústico. ACIONANDO.");
                                onEmergencyDetected();
                            } else {
                                console.warn("IA Rejeitou Evento Acústico (Falso Positivo).");
                            }
                        })
                        .catch(err => console.error("Erro na análise IA:", err))
                        .finally(() => {
                            setTimeout(() => {
                                if (isMountedRef.current) {
                                    setIsAnalyzing(false);
                                    isAnalyzingRef.current = false;
                                    try { recognition.start(); } catch(e){}
                                }
                            }, 3000);
                        });
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
          onEmergencyDetected();
          setIsAnalyzing(false);
          isAnalyzingRef.current = false;
          return;
      }

      // Verifica Biometria
      try {
        const result = await VoiceBiometryService.verifySpeakerIdentity(audioBlob);
        
        // Se verificado ou se o backend estiver offline (fail-open no service), aciona
        if (result && (result.isVerified || result.details === "Fail-Open (Backend Offline)")) {
            onEmergencyDetected();
        } else {
            // Em modo offline/crítico, a detecção da Wake Word tem peso alto.
            console.warn("Biometria inconclusiva, mas Wake Word detectada. ACIONANDO (Política de Segurança Máxima).");
            onEmergencyDetected();
        }
      } catch (err) {
          console.error("Erro na verificação biométrica:", err);
          // Fail-Safe: Se deu erro no serviço, ACIONA a emergência
          onEmergencyDetected();
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

         // --- MELHORIA v1.4: Contexto Híbrido (Acoustic + Keyword) ---
         // Só aceita o trigger se:
         // 1. Keyword Exact Match (Prioridade Alta)
         // 2. Keyword Fuzzy Match + Biometria OK (Prioridade Média)
         // 3. Keyword Match (Fuzzy/Exact) + Risco Acústico Moderado (Contexto de Confirmação)
         
         let match = false;
         
         // Verificação Exata (Precisa ser uma sentença distinta ou conter a frase completa)
         // "socorro" -> OK. "eu preciso de socorro agora" -> OK.
         // "o socorro vem ai" (rádio) -> Pode ser falso positivo.
         // Tentativa de mitigar rádio: Exigir que a frase não seja muito curta se for comum.
         const isExactMatch = normalizedText.includes(normalizedPhrase);

         if (isExactMatch) {
             match = true;
         } else {
             // Fuzzy Match
             const words = normalizedText.split(' ');
             const phraseLength = normalizedPhrase.split(' ').length;
             
             if (words.length >= phraseLength) {
                 const recentPhrase = words.slice(-phraseLength).join(' ');
                 const similarity = stringSimilarity.compareTwoStrings(recentPhrase, normalizedPhrase);
                 
                 console.log(`Fuzzy Match: "${recentPhrase}" vs "${normalizedPhrase}" = ${similarity.toFixed(2)}`);
                 
                 // Threshold alto (0.85)
                 if (similarity >= 0.85) { 
                     match = true;
                 }
             }
         }

         if (match) {
            // Check Acoustic Context (IRA-SUSI Score)
            // Se o ambiente estiver TOTALMENTE calmo (IRA < 0.3), desconfie de falsos positivos da WebSpeech
            // A menos que seja um Match Exato muito claro.
            
            // Mas o WebSpeech roda em paralelo. Vamos confiar na Biometria como filtro final.
            // Se a Biometria falhar E o IRA for baixo, ignoramos.
            
            console.log("Frase de emergência detectada! Tipo:", isExactMatch ? "EXATA" : "FUZZY");
            
            // Pausa reconhecimento
            try { recognition.stop(); } catch(e){}
            setIsAnalyzing(true);
            isAnalyzingRef.current = true;

            const audioBlob = RingBufferService.getWavBlob(5); // 5 segundos de contexto
            
            if (audioBlob.size < 1000) {
                console.warn("Buffer vazio.");
                if (isExactMatch) {
                     onEmergencyDetected();
                }
                setIsAnalyzing(false);
                return;
            }

            try {
                const result = await VoiceBiometryService.verifySpeakerIdentity(audioBlob);
                
                // LÓGICA DE DECISÃO v1.4 (Hardened)
                // 1. Biometria OK -> ACIONA
                if (result && (result.isVerified || result.details === "Fail-Open (Backend Offline)")) {
                    console.log("Biometria Verificada. ACIONANDO EMERGÊNCIA.");
                    onEmergencyDetected();
                } 
                // 2. Biometria Falhou -> Análise Contextual
                else {
                    console.warn("Biometria Falhou. Analisando contexto de risco...");
                    
                    // Recuperar último score IRA (se disponível no closure ou via ref, aqui assumimos acesso global ou via prop, mas temos o RingBuffer)
                    // Como não temos acesso direto ao IRA state aqui (apenas via callback), vamos ser conservadores.
                    
                    if (isExactMatch) {
                        // Se foi EXATO, ainda temos risco de ser rádio/TV.
                        // Mas sem biometria, é difícil distinguir.
                        // Política: Se for exato, aciona (Melhor falso positivo que negativo em morte).
                        console.warn("Match Exato sem Biometria. ACIONANDO (Política de Segurança).");
                        onEmergencyDetected();
                    } else {
                        // Fuzzy Match sem Biometria -> IGNORA (Muito risco de falso positivo "ajuda" vs "juda")
                        console.warn("Fuzzy Match sem Biometria. IGNORADO (Falso Positivo Bloqueado).");
                    }
                }
            } catch (err) {
                console.error("Erro técnico biometria:", err);
                // Fail-Safe apenas para Match Exato
                if (isExactMatch) {
                    onEmergencyDetected();
                }
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
  }, [isActive, emergencyPhrase, onEmergencyDetected]);

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

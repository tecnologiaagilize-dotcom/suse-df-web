import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Activity, ShieldCheck, WifiOff, Zap, Volume2 } from 'lucide-react';
import VoiceBiometryService from '../../services/VoiceBiometryService';
import RingBufferService from '../../services/RingBufferService';
import WakeWordService from '../../services/WakeWordService';
import VoiceActivityService from '../../services/VoiceActivityService';

export default function VoiceEmergencyListener({ emergencyPhrase, onEmergencyDetected, isActive = true, onTranscriptChange }) {
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false); // Novo estado VAD
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const isAnalyzingRef = useRef(isAnalyzing);
  
  // AudioWorklet Refs
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);

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

          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          const source = ctx.createMediaStreamSource(stream);

          const workletNode = new AudioWorkletNode(ctx, 'suse-audio-processor');
          
          // Receber dados da thread separada
          workletNode.port.onmessage = (event) => {
              if (event.data.eventType === 'audio_data') {
                  // Escrever no Ring Buffer APENAS se VAD detectar fala (Otimização)
                  // Ou mantemos sempre para ter pre-roll de ruído?
                  // Melhor manter sempre para contexto, o VAD já otimiza o WakeWord internamente.
                  RingBufferService.write(event.data.audioBuffer);
              }
          };

          source.connect(workletNode);
          workletNode.connect(ctx.destination); 
          
          workletNodeRef.current = workletNode;
          console.log("Audio Core v2 (Worklet + WakeWord + VAD) iniciado.");

      } catch (err) {
          console.error("Falha ao iniciar Audio Core v2:", err);
          setError("Erro no módulo de áudio: " + err.message);
      }
  };

  const stopAudioCore = () => {
      WakeWordService.stopListening();
      VoiceActivityService.stop(); // Parar VAD
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
      const isValid = await VoiceBiometryService.verifyVoice(audioBlob);
      
      if (isValid) {
          onEmergencyDetected();
          setTimeout(() => {
              setIsAnalyzing(false);
              isAnalyzingRef.current = false;
          }, 3000);
      } else {
          // Em modo offline/crítico, a detecção da Wake Word tem peso alto.
          // Se a biometria falhar, ainda acionamos (pode ser voz alterada por stress)
          console.warn("Biometria inconclusiva, mas Wake Word detectada. ACIONANDO.");
          onEmergencyDetected();
          setIsAnalyzing(false);
          isAnalyzingRef.current = false;
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

         if (normalizedText.includes(normalizedPhrase)) {
            console.log("Frase de emergência detectada! Iniciando análise biométrica...");
            
            // Pausa reconhecimento para evitar loop
            try { recognition.stop(); } catch(e){}
            setIsAnalyzing(true);
            isAnalyzingRef.current = true;

            // Recupera áudio do Ring Buffer (últimos 5 segundos)
            const audioBlob = RingBufferService.getWavBlob(5);
            
            if (audioBlob.size < 1000) {
                console.warn("Buffer de áudio vazio ou insuficiente.");
                // Fail-safe: Aciona mesmo sem biometria se o áudio falhou
                onEmergencyDetected();
                setIsAnalyzing(false);
                return;
            }

            // Verifica Biometria
            const isValid = await VoiceBiometryService.verifyVoice(audioBlob);
            
            if (isValid) {
                onEmergencyDetected();
                // Mantém isAnalyzing true por um tempo para feedback visual
                setTimeout(() => {
                    setIsAnalyzing(false);
                    isAnalyzingRef.current = false;
                }, 3000);
            } else {
                console.warn("Biometria de voz falhou ou inconclusiva.");
                // Em caso de dúvida crítica (score médio), podemos pedir confirmação ou acionar silencioso
                // Por enquanto, seguimos a regra de negócio: Se a frase bateu, aciona.
                // A biometria aqui serve mais para auditoria e redução de falso positivo de TV/Rádio.
                
                // Estratégia Híbrida:
                // Se score > 0.4 (incerto) -> Aciona
                // Se score < 0.2 (falso claro) -> Ignora (Loga tentativa)
                // Como o mock retorna true/false, assumimos true.
                
                // TODO: Refinar com score real do backend
                onEmergencyDetected();
                setIsAnalyzing(false);
                isAnalyzingRef.current = false;
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
    </div>
  );
}

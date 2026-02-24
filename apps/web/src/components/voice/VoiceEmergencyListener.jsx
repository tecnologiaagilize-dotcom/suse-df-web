import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Activity, ShieldCheck } from 'lucide-react';
import VoiceBiometryService from '../../services/VoiceBiometryService';

export default function VoiceEmergencyListener({ emergencyPhrase, onEmergencyDetected, isActive = true, onTranscriptChange }) {
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const isAnalyzingRef = useRef(isAnalyzing);
  
  // Efeito para notificar o componente pai sobre mudanças na transcrição
  useEffect(() => {
      if (onTranscriptChange && transcript) {
          onTranscriptChange(transcript);
      }
  }, [transcript, onTranscriptChange]);
  
  // Refs para gravação de áudio (Biometria)
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Gerenciamento do Gravador de Áudio (Rolling Buffer Circular Real)
  useEffect(() => {
    let intervalId;

    const startAudioCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(200); // 200ms chunks

        // Limpeza inteligente do buffer (Mantém últimos ~15 segundos)
        intervalId = setInterval(() => {
            if (!isAnalyzingRef.current && audioChunksRef.current.length > 100) {
                audioChunksRef.current = audioChunksRef.current.slice(20);
            }
        }, 2000);

      } catch (err) {
        console.warn("Erro ao iniciar captura de áudio para biometria:", err);
      }
    };

    if (isActive) {
        startAudioCapture();
    }

    return () => {
        clearInterval(intervalId);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
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
             // CORREÇÃO 3: Verificação de instância no retry de erro
             if (isActive && recognitionRef.current === recognition && !isAnalyzingRef.current) {
                 try { recognition.start(); } catch(e) {}
             }
         }, 2000);
      }
    };

    recognition.onresult = async (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const currentText = (finalTranscript || interimTranscript).toLowerCase().trim();
      
      if (currentText) {
         setTranscript(currentText);
         
         if (emergencyPhrase && !isAnalyzingRef.current) {
            const phraseWords = emergencyPhrase.toLowerCase().trim().split(/\s+/);
            const transcriptWords = currentText.split(/\s+/);
            const windowSize = phraseWords.length;
            
            let maxSimilarity = 0;
            const fullSimilarity = VoiceBiometryService.calculateSimilarity(currentText, emergencyPhrase);
            maxSimilarity = Math.max(maxSimilarity, fullSimilarity);

            if (transcriptWords.length >= windowSize) {
                for (let i = 0; i <= transcriptWords.length - windowSize; i++) {
                    const windowText = transcriptWords.slice(i, i + windowSize).join(' ');
                    const windowSim = VoiceBiometryService.calculateSimilarity(windowText, emergencyPhrase);
                    if (windowSim > maxSimilarity) maxSimilarity = windowSim;
                }
            }
            
            if (maxSimilarity > 0.6) {
                console.log(`[KWS] Detectado: ${(maxSimilarity*100).toFixed(1)}%`);
                
                setIsAnalyzing(true);
                isAnalyzingRef.current = true;
                
                recognition.stop(); // Para o reconhecimento para análise
                
                let audioBlob = null;
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                    await new Promise(r => setTimeout(r, 200)); 
                    audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                }

                if (audioBlob) {
                    VoiceBiometryService.verifySpeakerIdentity(audioBlob)
                        .then(({ isVerified, score }) => {
                            if (isVerified) {
                                onEmergencyDetected();
                            } else {
                                setIsAnalyzing(false); // Isso disparará o useEffect de reinício
                                isAnalyzingRef.current = false;
                            }
                        })
                        .catch(() => {
                            onEmergencyDetected(); // Fail-open
                            setIsAnalyzing(false);
                            isAnalyzingRef.current = false;
                        });
                } else {
                    onEmergencyDetected();
                    setIsAnalyzing(false);
                    isAnalyzingRef.current = false;
                }
            }
         }
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

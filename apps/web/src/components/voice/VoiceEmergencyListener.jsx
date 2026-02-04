import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, Activity, ShieldCheck } from 'lucide-react';
import { VoiceBiometryService } from '../../services/VoiceBiometryService';

export default function VoiceEmergencyListener({ emergencyPhrase, onEmergencyDetected, isActive = true }) {
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const isAnalyzingRef = useRef(isAnalyzing);
  
  // Refs para gravação de áudio (Biometria)
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  // Gerenciamento do Gravador de Áudio (Rolling Buffer simplificado)
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

        mediaRecorder.start();

        // Limpa o buffer a cada 10 segundos para não estourar a memória
        // Mantém apenas os últimos segundos "vivos" na memória do browser
        intervalId = setInterval(() => {
            if (!isAnalyzingRef.current) {
                // Se não estiver analisando, reseta o buffer
                // (Estratégia ingênua: perde o histórico a cada 10s. 
                // Para produção ideal, usaríamos um AudioWorklet com buffer circular real)
                audioChunksRef.current = [];
            }
        }, 10000);

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

  useEffect(() => {
    // Check browser support
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
      // Auto restart if it should be active and not currently analyzing
      if (isActive && recognitionRef.current && !isAnalyzingRef.current) {
         try {
           recognition.start();
         } catch (e) {
           setIsListening(false);
         }
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (event) => {
      // console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        setError('Permissão de microfone negada.');
        setIsListening(false);
      } else if (event.error === 'network') {
         // Silent retry for network errors
         setTimeout(() => {
             if (isActive && recognitionRef.current && !isAnalyzingRef.current) {
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

      // Combinar texto final e provisório para análise
      const currentText = (finalTranscript || interimTranscript).toLowerCase().trim();
      
      if (currentText) {
         setTranscript(currentText);
         
         if (emergencyPhrase && !isAnalyzingRef.current) {
            // 1. Keyword Spotting & Semantic Analysis (Sliding Window Strategy)
            const phraseWords = emergencyPhrase.toLowerCase().trim().split(/\s+/);
            const transcriptWords = currentText.split(/\s+/);
            const windowSize = phraseWords.length;
            
            let maxSimilarity = 0;
            
            // Verifica a frase inteira primeiro (caso o usuário diga apenas a frase)
            const fullSimilarity = VoiceBiometryService.calculateSimilarity(currentText, emergencyPhrase);
            maxSimilarity = Math.max(maxSimilarity, fullSimilarity);

            // Verifica janelas deslizantes se a transcrição for mais longa que a frase
            if (transcriptWords.length >= windowSize) {
                for (let i = 0; i <= transcriptWords.length - windowSize; i++) {
                    const windowText = transcriptWords.slice(i, i + windowSize).join(' ');
                    const windowSim = VoiceBiometryService.calculateSimilarity(windowText, emergencyPhrase);
                    if (windowSim > maxSimilarity) {
                        maxSimilarity = windowSim;
                    }
                }
            }
            
            // Reduzido threshold para 0.6 (60%) para facilitar testes
            // Em produção poderia ser 0.75 ou ajustável
            if (maxSimilarity > 0.6) {
                console.log(`[KWS] Frase detectada com similaridade de ${(maxSimilarity*100).toFixed(1)}%`);
                
                setIsAnalyzing(true);
                isAnalyzingRef.current = true;
                
                // Força a parada imediata para evitar duplicação
                recognition.stop(); 
                
                // Parar gravação de áudio para capturar o blob
                let audioBlob = null;
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                    // Pequeno delay para garantir que o ondataavailable disparou
                    await new Promise(r => setTimeout(r, 200)); 
                    audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                }

                // 2. Biometric Verification (Agora Real via Backend)
                if (audioBlob) {
                    VoiceBiometryService.verifySpeakerIdentity(audioBlob)
                        .then(({ isVerified, score }) => {
                            if (isVerified) {
                                console.log(`[Biometria] Verificado pelo servidor. Score: ${score}`);
                                onEmergencyDetected();
                            } else {
                                console.warn(`[Biometria] Falha na verificação do servidor.`);
                                setIsAnalyzing(false);
                                isAnalyzingRef.current = false;
                            }
                        })
                        .catch(err => {
                            console.error("Erro na validação biométrica:", err);
                            // Fail-safe: Em emergência real, se o servidor falhar, o que fazemos?
                            // Por enquanto, bloqueamos.
                            setIsAnalyzing(false);
                            isAnalyzingRef.current = false;
                        });
                } else {
                    console.warn("Audio Blob não gerado. Pulando biometria.");
                    // Fallback se o áudio falhar?
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
      {isAnalyzing ? (
          <ShieldCheck className="w-4 h-4 animate-bounce" />
      ) : isListening ? (
          <Mic className="w-4 h-4 animate-pulse" />
      ) : (
          <MicOff className="w-4 h-4" />
      )}
      
      <div className="flex flex-col leading-tight">
          <span className="font-medium">
            {isAnalyzing ? 'Validando Biometria...' : 
            isListening ? 'Monitoramento Ativo' : 
            'Voz Inativa'}
          </span>
          {emergencyPhrase && isListening && (
              <div className="flex flex-col">
                <span className="text-[10px] opacity-60">Frase alvo: "{emergencyPhrase}"</span>
                <span className="text-[10px] text-blue-600">Ouvido: "{transcript || '...'}"</span>
              </div>
          )}
      </div>
      
      {isListening && !isAnalyzing && (
          <div className="flex items-center gap-2 border-l pl-2 border-green-300 ml-2">
              <Activity className="w-3 h-3 opacity-50" />
              <span className="text-xs opacity-70 max-w-[100px] truncate italic">
                  {transcript || '...'}
              </span>
          </div>
      )}
    </div>
  );
}

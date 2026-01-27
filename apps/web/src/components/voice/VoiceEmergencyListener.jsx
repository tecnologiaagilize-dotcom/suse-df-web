import React, { useEffect, useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

export default function VoiceEmergencyListener({ emergencyPhrase, onEmergencyDetected, isActive = true }) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

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

    recognition.onstart = () => {
      setIsListening(true);
      setError('');
    };

    recognition.onend = () => {
      // Auto restart if it should be active
      if (isActive && recognitionRef.current) {
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
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        setError('Permissão de microfone negada.');
        setIsListening(false);
      } else if (event.error === 'network') {
         // Erro de rede comum, tentar reconectar silenciosamente após 2s
         // console.warn('Erro de rede no reconhecimento de voz. Tentando reconectar...'); // Comentado para não poluir
         setTimeout(() => {
             if (isActive && recognitionRef.current) {
                 try { recognition.start(); } catch(e) {}
             }
         }, 2000);
      }
    };

    recognition.onresult = (event) => {
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
      const cleanPhrase = emergencyPhrase?.toLowerCase().trim();

      if (currentText) {
         setTranscript(currentText);
         // console.log(`Ouvindo: "${currentText}"`); // Debug (pode ser ruidoso)

         if (cleanPhrase && currentText.includes(cleanPhrase)) {
            console.log("!!! FRASE DE EMERGÊNCIA DETECTADA !!!");
            // Parar reconhecimento para evitar múltiplos disparos
            recognition.stop(); 
            onEmergencyDetected();
         }
      }
    };

    recognitionRef.current = recognition;

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
    return <div className="text-xs text-red-500 mt-2">{error}</div>;
  }

  return (
    <div className={`flex items-center space-x-2 text-sm p-2 rounded-full ${isListening ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
      {isListening ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
      <span>{isListening ? 'Monitoramento de Voz Ativo' : 'Voz Inativa'}</span>
      {isListening && <span className="text-xs opacity-50 ml-2 max-w-[150px] truncate border-l pl-2 border-gray-300">{transcript || 'Ouvindo...'}</span>}
    </div>
  );
}

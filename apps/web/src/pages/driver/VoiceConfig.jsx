import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mic, AlertCircle, PlayCircle, Square, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function VoiceConfig() {
  const [recordingStep, setRecordingStep] = useState(0); // 0, 1, 2 (Biometria), 3 (Frase Secreta)
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]); // Array de booleanos para UI
  const [audioBlobs, setAudioBlobs] = useState({}); // Armazena os Blobs reais: { 0: blob, 1: blob, 2: blob, 'emergency': blob }
  const [emergencyPhrase, setEmergencyPhrase] = useState('');
  const [phraseAudioRecorded, setPhraseAudioRecorded] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [configPhrases, setConfigPhrases] = useState([]);
  const [loadingPhrases, setLoadingPhrases] = useState(true);
  const [currentTranscript, setCurrentTranscript] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);

  const navigate = useNavigate();
  const { user } = useAuth(); 

  // Carregar frases de configuração do Supabase
  useEffect(() => {
    async function fetchPhrases() {
      try {
        const { data, error } = await supabase
          .from('voice_phrases')
          .select('*')
          .order('sequence_order', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setConfigPhrases(data);
        } else {
          setConfigPhrases([
            { phrase_text: "O sistema de segurança está ativo" },
            { phrase_text: "Minha voz é minha identidade" },
            { phrase_text: "Autorização confirmada pelo motorista" }
          ]);
        }
      } catch (err) {
        console.error("Erro ao carregar frases:", err);
        setConfigPhrases([
            { phrase_text: "O sistema de segurança está ativo" },
            { phrase_text: "Minha voz é minha identidade" },
            { phrase_text: "Autorização confirmada pelo motorista" }
        ]);
      } finally {
        setLoadingPhrases(false);
      }
    }
    
    fetchPhrases();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 1. Configurar MediaRecorder (Áudio para Biometria)
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4' };
          else if (MediaRecorder.isTypeSupported('audio/ogg')) options = { mimeType: 'audio/ogg' };
          else options = undefined;
      }

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blobType = mediaRecorderRef.current.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        console.log(`Gravação finalizada. Tamanho: ${audioBlob.size}, Tipo: ${blobType}`);
        
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        
        if (audioBlob.size < 100) {
            alert("Áudio muito curto ou vazio. Por favor, tente novamente.");
            return;
        }

        if (recordingStep < 3) {
            setAudioBlobs(prev => ({ ...prev, [recordingStep]: audioBlob }));
            const newRecordings = [...recordings];
            newRecordings[recordingStep] = true;
            setRecordings(newRecordings);
            setRecordingStep(recordingStep + 1);
        } else {
            setAudioBlobs(prev => ({ ...prev, 'emergency': audioBlob }));
            setPhraseAudioRecorded(true);
        }
        
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setCurrentTranscript(''); // Limpar transcrição ao finalizar
      };

      // 2. Configurar SpeechRecognition (Feedback Visual)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'pt-BR';
          
          recognition.onresult = (event) => {
              let interimTranscript = '';
              for (let i = event.resultIndex; i < event.results.length; i++) {
                  const transcript = event.results[i][0].transcript;
                  if (event.results[i].isFinal) {
                      interimTranscript += transcript;
                  } else {
                      interimTranscript += transcript;
                  }
              }
              setCurrentTranscript(interimTranscript);
          };
          
          recognition.start();
          recognitionRef.current = recognition;
      }

      mediaRecorderRef.current.start(100); 
      setIsRecording(true);
      setCurrentTranscript('Ouvindo...');

    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          alert("Permissão de microfone negada. Por favor, permita o acesso nas configurações do navegador.");
      } else {
          alert("Erro ao iniciar gravação: " + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
  };

  const uploadAudio = async (blob, path) => {
      if (!blob) return null;
      try {
          const { data, error } = await supabase.storage
              .from('voice-recordings')
              .upload(path, blob, {
                  contentType: 'audio/webm',
                  upsert: true
              });
          
          if (error) {
             // Fallback para bucket 'avatars' se 'voice-recordings' não existir
             console.warn("Bucket voice-recordings falhou, tentando avatars:", error.message);
             const { error: backupError } = await supabase.storage
                .from('avatars')
                .upload(path, blob, { contentType: 'audio/webm', upsert: true });
                
             if (backupError) throw backupError;
             
             const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path);
             return publicData.publicUrl;
          }
          
          const { data: publicData } = supabase.storage
              .from('voice-recordings')
              .getPublicUrl(path);
              
          return publicData.publicUrl;
      } catch (error) {
          console.error(`Erro upload ${path}:`, error);
          return null;
      }
  };

  const handleSavePhrase = async () => {
    console.log("Botão Salvar clicado. Estado atual:", { emergencyPhrase, phraseAudioRecorded, audioBlobs });

    // Validações
    if (emergencyPhrase.trim().split(' ').length < 2) {
      alert("A frase deve ter pelo menos 2 palavras.");
      return;
    }
    
    // Verificação dupla do estado de gravação
    if (!phraseAudioRecorded && !audioBlobs['emergency']) {
      alert("Você precisa gravar o áudio da frase de emergência.");
      return;
    }

    setIsSaving(true);

    try {
        console.log("Iniciando processo de salvamento...");
        
        // 1. Upload dos Áudios
        const biometryUrls = {};
        for (let i = 0; i < 3; i++) {
            if (audioBlobs[i]) {
                const url = await uploadAudio(audioBlobs[i], `${user.id}/biometry_${i+1}.webm`);
                if (url) biometryUrls[`voice_biometry_${i+1}_url`] = url;
            }
        }

        let emergencyAudioUrl = null;
        if (audioBlobs['emergency']) {
            emergencyAudioUrl = await uploadAudio(audioBlobs['emergency'], `${user.id}/emergency_phrase.webm`);
        }

        // 2. Atualizar tabela users
        // Atualiza colunas de URLs e a frase secreta
        const updateData = {
            secret_word: emergencyPhrase,
            updated_at: new Date().toISOString()
        };

        // Adiciona URLs se existirem
        if (biometryUrls['voice_biometry_1_url']) updateData.voice_biometry_1_url = biometryUrls['voice_biometry_1_url'];
        if (biometryUrls['voice_biometry_2_url']) updateData.voice_biometry_2_url = biometryUrls['voice_biometry_2_url'];
        if (biometryUrls['voice_biometry_3_url']) updateData.voice_biometry_3_url = biometryUrls['voice_biometry_3_url'];
        if (emergencyAudioUrl) updateData.secret_word_audio_url = emergencyAudioUrl;

        const { error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', user.id);

        if (error) {
            console.warn("Update direto falhou (provavelmente colunas inexistentes), usando metadata:", error.message);
            // Se falhar o update direto, garantimos que pelo menos o metadata seja salvo
        }
        
        // 3. Salvar TUDO no Auth Metadata (Garantia de funcionamento sem migração de banco)
        const metadataUpdates = {
            emergency_phrase: emergencyPhrase,
            ...biometryUrls,
            emergency_audio_url: emergencyAudioUrl,
            voice_config_completed: true
        };

        const { error: authError } = await supabase.auth.updateUser({
            data: metadataUpdates
        });

        if (authError) throw authError;
        
        console.log("Configuração salva com sucesso (Metadata)!");
        setSuccess(true);

    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar: " + error.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleFinish = () => {
    navigate('/driver/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Mic className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Configuração de Voz</h2>
          <p className="text-xs text-gray-400 mb-4">Versão 1.3.0 - Build {new Date().toISOString().slice(0,16)}</p>
          {recordingStep < 3 && !success && (
            <p className="mt-2 text-sm text-gray-600">
              Precisamos gravar 3 frases para criar seu perfil de segurança.
            </p>
          )}
          {recordingStep === 3 && !success && (
            <p className="mt-2 text-sm text-gray-600">
              Agora, defina sua **Palavra ou Frase de Emergência**.
            </p>
          )}
        </div>

        {success ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h3 className="text-xl font-medium text-gray-900">Configuração Concluída!</h3>
            <p className="text-gray-500">Seu perfil biométrico e frase de emergência foram salvos e os áudios enviados para análise segura.</p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Sua frase secreta:</p>
              <p className="text-lg font-bold text-blue-600">"{emergencyPhrase}"</p>
            </div>
            <button
              onClick={handleFinish}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Ir para o Painel
            </button>
          </div>
        ) : recordingStep < 3 ? (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Frase {recordingStep + 1} de 3 (Biometria)</h3>
              <p className="text-gray-600 italic">
                "{configPhrases[recordingStep]?.phrase_text || "Carregando frase..."}"
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`p-6 rounded-full transition-all select-none touch-none ${
                  isRecording 
                    ? 'bg-blue-100 text-blue-600 scale-110 ring-4 ring-blue-200' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                }`}
              >
                {isRecording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
            </div>

            <p className="text-center text-sm text-gray-500">
              {isRecording ? 'Solte para parar de gravar' : 'Segure o botão para gravar a frase'}
            </p>
            
            {/* Feedback de Transcrição */}
            {currentTranscript && (
                <div className="text-center text-sm text-blue-600 italic font-medium animate-pulse">
                    Ouvindo: "{currentTranscript}..."
                </div>
            )}

            <div className="flex justify-center space-x-2">
              {[0, 1, 2].map((step) => (
                <div
                  key={step}
                  className={`h-2 w-2 rounded-full ${
                    step < recordingStep || (step === recordingStep && recordings[step])
                      ? 'bg-green-500'
                      : step === recordingStep
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
              <div className="h-2 w-2 rounded-full bg-gray-300" /> {/* Passo final da frase */}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-medium text-yellow-900 mb-2">Definir Frase de Socorro</h3>
              <p className="text-sm text-yellow-800">
                Esta é a frase que você dirá em caso de perigo real. Escolha algo que você lembre facilmente, mas que não use em conversas normais.
              </p>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Digite sua frase (min. 2 palavras):</label>
                <input
                 type="text"
                 className="appearance-none rounded-md block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                 placeholder="Ex: banana azul"
                 value={emergencyPhrase}
                 onChange={(e) => setEmergencyPhrase(e.target.value)}
               />
            </div>

             <div className="flex justify-center">
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={isSaving || emergencyPhrase.length < 3}
                className={`p-4 rounded-full transition-all flex items-center space-x-2 select-none touch-none ${
                  isRecording 
                    ? 'bg-blue-100 text-blue-600 scale-105' 
                    : phraseAudioRecorded
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                <span className="text-sm font-medium">
                  {isRecording 
                    ? 'Gravando...' 
                    : phraseAudioRecorded 
                      ? 'Áudio gravado (Segure para regravar)' 
                      : 'Segure para gravar áudio (Obrigatório)'}
                </span>
              </button>
            </div>
            
            {/* Feedback de Transcrição para Frase de Emergência */}
            {currentTranscript && (
                <div className="text-center text-sm text-blue-600 italic font-medium animate-pulse">
                    Ouvindo: "{currentTranscript}..."
                </div>
            )}

            <button
              onClick={handleSavePhrase}
              disabled={emergencyPhrase.trim().split(' ').length < 2 || (!phraseAudioRecorded && !audioBlobs['emergency']) || isSaving}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isSaving ? (
                  <>
                    <Loader className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                    Salvando e Enviando Áudios...
                  </>
              ) : (
                  'Salvar e Finalizar'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

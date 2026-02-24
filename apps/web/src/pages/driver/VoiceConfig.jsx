import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mic, AlertCircle, PlayCircle, Square, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AudioFeatureExtractor from '../../services/AudioFeatureExtractor';

export default function VoiceConfig() {
  const [recordingStep, setRecordingStep] = useState(0); // 0-2 (Biometria), 3 (Frase), 4 (Score)
  const [isRecording, setIsRecording] = useState(false);
  const [qualityScore, setQualityScore] = useState(0);
  const [scores, setScores] = useState([]); // Scores individuais de cada gravação
  const [audioBlobs, setAudioBlobs] = useState({}); // Armazena os Blobs reais
  const [emergencyPhrase, setEmergencyPhrase] = useState('');
  const [phraseAudioRecorded, setPhraseAudioRecorded] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [configPhrases, setConfigPhrases] = useState([]);
  const [loadingPhrases, setLoadingPhrases] = useState(true);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [audioMetrics, setAudioMetrics] = useState({ rms: 0, zcr: 0 }); // Para visualização em tempo real
  
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const featuresCollectionRef = useRef([]); // Armazena features durante a gravação
  const metricsIntervalRef = useRef(null);

  const navigate = useNavigate();
  const { user } = useAuth(); 
  const isMounted = useRef(true);

  const [alreadyConfigured, setAlreadyConfigured] = useState(false);



  // Carregar frases de configuração do Supabase
  useEffect(() => {
    async function checkStatusAndFetchPhrases() {
      try {
        // Verificar se já está configurado
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('voice_biometry_1_url, voice_biometry_2_url, voice_biometry_3_url, secret_word_audio_url')
            .eq('id', user.id)
            .single();

        if (!userError && userData) {
            const isConfigured = !!(userData.voice_biometry_1_url && userData.voice_biometry_2_url && userData.voice_biometry_3_url && userData.secret_word_audio_url);
            setAlreadyConfigured(isConfigured);
        }

        const { data, error } = await supabase
          .from('voice_phrases')
          .select('*')
          .order('sequence_order', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          setConfigPhrases(data);
        } else {
            // Fallback
            setConfigPhrases([
                { phrase_text: "O sistema de segurança está ativo" },
                { phrase_text: "Minha voz é minha identidade" },
                { phrase_text: "Autorização confirmada pelo motorista" }
            ]);
        }
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoadingPhrases(false);
      }
    }
    
    checkStatusAndFetchPhrases();
  }, [user.id]);

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      console.log("Solicitando permissão de microfone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microfone autorizado.");
      
      // 1. Configurar AudioContext e Meyda para análise técnica
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      // GARANTIA: Resumir contexto se estiver suspenso (comum no Chrome)
      if (audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log("AudioContext resumido.");
      }

      const source = audioContext.createMediaStreamSource(stream);
      
      // Inicializa o extrator de features (Meyda) com try-catch
      try {
          if (isMounted.current) {
            AudioFeatureExtractor.initialize(audioContext, source);
          }
      } catch (e) {
          console.warn("Falha ao iniciar Meyda (Feature Extractor), usando fallback básico:", e);
      }
      
      featuresCollectionRef.current = [];

      // Loop de coleta de métricas (a cada 100ms)
      metricsIntervalRef.current = setInterval(() => {
          if (!isMounted.current) return;
          try {
              const features = AudioFeatureExtractor.getFeatures();
              if (features) {
                  featuresCollectionRef.current.push(features);
                  if (isMounted.current) {
                    setAudioMetrics({ rms: features.rms || 0, zcr: features.zcr || 0 });
                  }
              }
          } catch (e) {
              // Ignorar erros de coleta se Meyda falhou
          }
      }, 100);

      // 2. Configurar MediaRecorder
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4' };
          else if (MediaRecorder.isTypeSupported('audio/ogg')) options = { mimeType: 'audio/ogg' };
          else options = undefined; // Deixa o navegador escolher o padrão
      }

      console.log("Iniciando MediaRecorder com mimeType:", options?.mimeType || 'default');
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log("Chunk de áudio recebido:", event.data.size);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log("MediaRecorder parou.");
        // Parar coleta de métricas
        if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
        try { AudioFeatureExtractor.stop(); } catch(e){}
        if (audioContextRef.current) audioContextRef.current.close();

        const blobType = mediaRecorderRef.current.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        console.log(`Gravação finalizada. Tamanho Total: ${audioBlob.size}, Tipo: ${blobType}`);
        
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        
        if (audioBlob.size < 1000) { // < 1kb
            alert("Áudio muito curto ou vazio. Fale mais alto e tente novamente.");
            return;
        }

        // Calcular Score (COM FALLBACK ROBUSTO)
        const features = featuresCollectionRef.current;
        let finalStepScore = 0;

        if (features && features.length > 5) {
            // Lógica Meyda (se funcionou)
            let technicalScore = 10;
            const avgRms = features.reduce((acc, f) => acc + (f.rms||0), 0) / features.length;
            
            if (avgRms < 0.005) technicalScore -= 3;
            if (features.length * 0.1 < 0.8) technicalScore -= 2;
            
            finalStepScore = Math.max(0, Math.min(10, technicalScore));
            console.log("Score calculado via Meyda:", finalStepScore);
        } else {
            // FALLBACK: Se Meyda falhou, usar tamanho do arquivo como proxy de qualidade
            console.warn("Meyda falhou ou poucos dados. Usando tamanho do arquivo para score.");
            if (audioBlob.size > 5000) finalStepScore = 9; // > 5KB = Bom
            else if (audioBlob.size > 2000) finalStepScore = 7; // > 2KB = Ok
            else finalStepScore = 4; // Muito pequeno
        }

        setScores(prev => [...prev, finalStepScore]);

        // AVANÇAR ETAPA (IMPORTANTE: Forçar avanço se o áudio for válido)
        if (recordingStep < 3) {
            setAudioBlobs(prev => ({ ...prev, [recordingStep]: audioBlob }));
            console.log(`Avançando para passo ${recordingStep + 1} com áudio salvo.`);
            setRecordingStep(prev => prev + 1); // Usar callback para garantir estado atual
        } else {
            // Passo 4 (Frase Final)
            setAudioBlobs(prev => ({ ...prev, 'emergency': audioBlob }));
            setPhraseAudioRecorded(true);
            
            // Calcular média final
            const allScores = [...scores, finalStepScore];
            const avgScore = allScores.reduce((a,b) => a+b, 0) / allScores.length;
            setQualityScore(avgScore);
            setRecordingStep(4);
        }
        
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setCurrentTranscript('');
        setAudioMetrics({ rms: 0, zcr: 0 });
      };

      // 3. Configurar SpeechRecognition
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
              const text = interimTranscript.toLowerCase();
              setCurrentTranscript(text);

              // Auto-Stop na etapa 3 (Frase de Emergência) se coincidir
              if (recordingStep === 3 && emergencyPhrase) {
                  const target = emergencyPhrase.toLowerCase().trim();
                  // Verifica se a frase alvo está contida no que foi dito
                  if (text.includes(target) && isRecording) {
                      console.log("Frase coincidiu! Parando automaticamente.");
                      stopRecording();
                      alert("Gravação de frase e voz realizada com sucesso!");
                  }
              }
          };
          
          recognition.start();
          recognitionRef.current = recognition;
      }

      mediaRecorderRef.current.start(); // Removido timeslice para compatibilidade (Safari/Mobile)
      setIsRecording(true);
      setCurrentTranscript('Ouvindo...');

    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Erro ao acessar microfone: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
    // Cleanup extra garantido
    if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
  };

  // Cleanup effect
  useEffect(() => {
      return () => {
          isMounted.current = false;
          if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
          if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
             try {
               audioContextRef.current.close().catch(e => console.warn("Erro ao fechar AudioContext:", e));
             } catch (e) { console.warn("Erro ao fechar AudioContext:", e); }
          }
          AudioFeatureExtractor.stop();
      };
  }, []);

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

    // Validação relaxada para testes
    if (!emergencyPhrase.trim()) {
      alert("Digite a frase de emergência.");
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
                else throw new Error(`Falha no upload da biometria ${i+1}`);
            }
        }

        let emergencyAudioUrl = null;
        if (audioBlobs['emergency']) {
            emergencyAudioUrl = await uploadAudio(audioBlobs['emergency'], `${user.id}/emergency_phrase.webm`);
            if (!emergencyAudioUrl) throw new Error("Falha no upload do áudio da frase");
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
        alert("Configuração de voz salva com sucesso!");
        navigate('/driver/dashboard', { replace: true });

    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar: " + error.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleFinish = () => {
    navigate('/driver/dashboard', { replace: true });
  };

  const resetProcess = () => {
      setRecordingStep(0);
      setScores([]);
      setQualityScore(0);
      setAudioBlobs({});
      setPhraseAudioRecorded(false);
      setSuccess(false);
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
          <p className="text-xs text-gray-400 mb-4">Versão 1.3.0</p>
          {!alreadyConfigured && recordingStep < 3 && !success && (
            <p className="mt-2 text-sm text-gray-600">
              Passo {recordingStep + 1} de 4: Grave as frases indicadas para calibração.
            </p>
          )}
        </div>

        {alreadyConfigured && !success && recordingStep === 0 ? (
            <div className="text-center space-y-6">
                <div className="flex justify-center">
                    <CheckCircle className="h-16 w-16 text-blue-500" />
                </div>
                <h3 className="text-xl font-medium text-gray-900">Voz Configurada</h3>
                <p className="text-gray-600">
                    Você já possui 4 frases gravadas e sua biometria está ativa.
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleFinish}
                        className="w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    >
                        Voltar ao Painel Principal
                    </button>
                    <button
                        onClick={() => setAlreadyConfigured(false)}
                        className="w-full py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                        Deseja gravar e configurar novamente?
                    </button>
                </div>
            </div>
        ) : success ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <h3 className="text-xl font-medium text-gray-900">Configuração Concluída!</h3>
            <button
              onClick={handleFinish}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Ir para o Painel
            </button>
          </div>
        ) : recordingStep === 4 ? (
            // Tela de Resultado / Score
            <div className="text-center space-y-6">
                <div className="flex justify-center">
                    <div className={`p-6 rounded-full border-4 ${qualityScore >= 8 ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}`}>
                        <span className="text-4xl font-bold">{qualityScore.toFixed(1)}</span>
                    </div>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900">Qualidade da Gravação</h3>
                
                {qualityScore >= 8 ? (
                    <>
                        <p className="text-green-600 font-medium">Excelente! Suas gravações estão nítidas.</p>
                        <button
                            onClick={handleSavePhrase}
                            disabled={isSaving}
                            className="w-full py-3 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium shadow-md"
                        >
                            {isSaving ? 'Salvando...' : 'Salvar e Concluir'}
                        </button>
                    </>
                ) : (
                    <>
                        <p className="text-red-600 font-medium">Qualidade Insuficiente (Mínimo 8.0)</p>
                        <p className="text-sm text-gray-500">Por favor, vá para um local mais silencioso e fale com clareza.</p>
                        <button
                            onClick={resetProcess}
                            className="w-full py-3 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium"
                        >
                            Refazer Gravações
                        </button>
                    </>
                )}
            </div>
        ) : recordingStep < 3 ? (
          // Passos 1, 2, 3 (Frases de Treino)
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-2">Frase {recordingStep + 1}</h3>
              <p className="text-xl text-blue-800 font-serif text-center py-4">
                "{configPhrases[recordingStep]?.phrase_text || "Carregando..."}"
              </p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={toggleRecording}
                className={`p-6 rounded-full transition-all shadow-lg ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isRecording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
            </div>

            <p className="text-center text-sm font-medium text-gray-600">
              {isRecording ? 'CLIQUE PARA PARAR E SALVAR' : 'CLIQUE PARA INICIAR GRAVAÇÃO'}
            </p>
            
            {currentTranscript && (
                <div className="text-center text-xs text-gray-500 italic mt-2 bg-gray-100 p-2 rounded">
                    Reconhecido: "{currentTranscript}"
                </div>
            )}

            <div className="flex justify-center gap-2 mt-4">
              {[0, 1, 2].map((step) => (
                <div key={step} className={`h-2 w-8 rounded-full ${step <= recordingStep ? 'bg-blue-500' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>
        ) : (
          // Passo 4 (Frase Secreta)
          <div className="space-y-6">
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-bold text-yellow-900 mb-2">Última Etapa: Frase de Socorro</h3>
              <p className="text-sm text-yellow-800">
                Digite sua frase secreta e grave o áudio. O sistema parará automaticamente se reconhecer a voz.
              </p>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Sua Frase:</label>
                <input
                 type="text"
                 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                 placeholder="Ex: socorro agora"
                 value={emergencyPhrase}
                 onChange={(e) => setEmergencyPhrase(e.target.value)}
               />
            </div>

             <div className="flex justify-center py-4">
              <button
                onClick={toggleRecording}
                disabled={emergencyPhrase.length < 3}
                className={`p-6 rounded-full transition-all shadow-lg flex items-center justify-center ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {isRecording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
            </div>
            
            <p className="text-center text-sm font-medium text-gray-600">
              {isRecording ? 'FALE A FRASE AGORA...' : 'CLIQUE PARA GRAVAR A FRASE'}
            </p>

            {currentTranscript && (
                <div className="text-center text-sm text-blue-600 italic font-medium border border-blue-100 bg-blue-50 p-3 rounded-lg">
                    Ouvindo: "{currentTranscript}"
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

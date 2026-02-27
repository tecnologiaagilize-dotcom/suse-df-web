import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mic, AlertCircle, PlayCircle, Square, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AudioFeatureExtractor from '../../services/AudioFeatureExtractor';
import stringSimilarity from 'string-similarity'; // Importação

export default function PassengerVoiceConfig() {
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
  const [baselineData, setBaselineData] = useState([]); // Armazena estatísticas de cada gravação para o IRA-SUSI
  
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
  const [showStepResult, setShowStepResult] = useState(false);
  const [currentStepScore, setCurrentStepScore] = useState(0);



  // Carregar frases de configuração do Supabase
  useEffect(() => {
    async function checkStatusAndFetchPhrases() {
      try {
        // Verificar se já está configurado
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('voice_biometry_1_url, voice_biometry_2_url, voice_biometry_3_url, secret_word_audio_url, secret_word')
            .eq('id', user.id)
            .single();

        if (!userError && userData) {
            const isConfigured = !!(userData.voice_biometry_1_url && userData.voice_biometry_2_url && userData.voice_biometry_3_url && userData.secret_word_audio_url);
            setAlreadyConfigured(isConfigured);
            
            // Se já tiver uma frase configurada, preenche o estado
            if (userData.secret_word) {
                setEmergencyPhrase(userData.secret_word);
            }
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
                { phrase_text: "Autorização confirmada pelo passageiro" }
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
      // --- MELHORIA DE CAPTAÇÃO: Noise Suppression & Echo Cancellation ---
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              channelCount: 1,
              sampleRate: 48000 // Alta qualidade para armazenamento
          } 
      });
      
      // 1. Configurar AudioContext e Pipeline de Processamento de Áudio (Web Audio API)
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);

      // Filtro High-Pass (Remove ruídos graves/rumble abaixo de 85Hz)
      const lowCutFilter = audioContext.createBiquadFilter();
      lowCutFilter.type = 'highpass';
      lowCutFilter.frequency.value = 85;

      // Compressor (Normaliza o volume e evita picos)
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      // Destino do Stream Processado
      const destination = audioContext.createMediaStreamDestination();

      // Conectar o grafo: Source -> Filter -> Compressor -> Destination
      source.connect(lowCutFilter);
      lowCutFilter.connect(compressor);
      compressor.connect(destination);
      
      // Inicializa o extrator de features (Meyda) com o sinal processado (mais limpo)
      if (isMounted.current) {
        // Garantir que AudioContext está rodando
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        AudioFeatureExtractor.initialize(audioContext, compressor);
      }
      featuresCollectionRef.current = [];

      // Loop de coleta de métricas (a cada 100ms)
      metricsIntervalRef.current = setInterval(() => {
          if (!isMounted.current) return;
          const features = AudioFeatureExtractor.getFeatures();
          if (features) {
              featuresCollectionRef.current.push(features);
              // Atualiza estado para visualização simples (opcional)
              if (isMounted.current) {
                setAudioMetrics({ 
                    rms: features.rms, 
                    zcr: features.zcr 
                });
              }
          }
      }, 100);

      // 2. Configurar MediaRecorder com o Stream Processado
      let options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 };
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          if (MediaRecorder.isTypeSupported('audio/mp4')) options = { mimeType: 'audio/mp4', audioBitsPerSecond: 128000 };
          else if (MediaRecorder.isTypeSupported('audio/ogg')) options = { mimeType: 'audio/ogg', audioBitsPerSecond: 128000 };
          else options = undefined;
      }

      // Usar o stream processado (destination.stream) em vez do raw (stream)
      mediaRecorderRef.current = new MediaRecorder(destination.stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        // Parar coleta de métricas
        if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
        AudioFeatureExtractor.stop();
        if (audioContextRef.current) audioContextRef.current.close();

        const blobType = mediaRecorderRef.current.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        console.log(`Gravação finalizada. Tamanho: ${audioBlob.size}, Tipo: ${blobType}`);
        
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        
        if (audioBlob.size < 1000) { // < 1kb é muito pouco
            alert("Áudio muito curto ou vazio. Por favor, tente novamente.");
            return;
        }

        // Calcular Score REAL baseado em features acústicas (Meyda) e transcrição
        const features = featuresCollectionRef.current;
        let technicalScore = 10; // Começa com 10
        let penalties = [];

        // --- IRA-SUSI Baseline Capture ---
        if (features.length > 5) {
            const computeStat = (key) => {
                const values = features.map(f => f[key]);
                const mean = values.reduce((a,b) => a+b, 0) / values.length;
                const variance = values.reduce((a,b) => a + Math.pow(b-mean, 2), 0) / values.length;
                return { mu: mean, sigma: Math.sqrt(variance) };
            };
            
            const stats = {
                energy: computeStat('dbfs'), // Usar dBFS para baseline de energia
                pitch: computeStat('pitch'),
                jitter: computeStat('jitter'),
                shimmer: computeStat('shimmer'),
                hnr: computeStat('hnr')
            };
            
            // Armazena estatísticas desta gravação
            setBaselineData(prev => [...prev, stats]);
            console.log("IRA-SUSI Stats Capturados:", stats);
        }
        // ---------------------------------

        // 1. Análise de Volume (RMS)
        const avgRms = features.reduce((acc, f) => acc + f.rms, 0) / (features.length || 1);
        const maxRms = Math.max(...features.map(f => f.rms));
        
        // Ajuste: Aumentar tolerância para silêncio e penalizar fortemente
        if (avgRms < 0.005) { // Silêncio Prático
            technicalScore = 0; // Invalida gravação
            penalties.push("Microfone não detectou som (Silêncio)");
        } else if (avgRms < 0.02) { // Muito baixo
            technicalScore -= 5; 
            penalties.push("Voz muito baixa");
        }
        
        if (maxRms > 0.98) {
            technicalScore -= 3; 
            penalties.push("Áudio estourado/saturado");
        }

        // 2. Análise de Ruído (ZCR - Zero Crossing Rate)
        const avgZcr = features.reduce((acc, f) => acc + f.zcr, 0) / (features.length || 1);
        if (avgZcr > 0.4) {
            technicalScore -= 3;
            penalties.push("Ambiente muito ruidoso");
        }

        // 3. Duração
        const durationSec = features.length * 0.1; // aprox (100ms interval)
        if (durationSec < 0.8) {
            technicalScore -= 5;
            penalties.push("Gravação muito curta");
        }

        // 4. Validação Fonética (Frase Escrita vs Falada)
        const speechSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
        let similarityScore = 0;

        if (speechSupported) {
             const targetPhrase = recordingStep < 3 
                ? configPhrases[recordingStep]?.phrase_text?.toLowerCase() 
                : emergencyPhrase.toLowerCase();
             
             // Usa biblioteca de similaridade (Dice Coefficient / Levenshtein)
             const match = stringSimilarity.compareTwoStrings(currentTranscript || "", targetPhrase || "");
             similarityScore = match * 10; // Escala 0-10
             
             console.log(`Validação Fonética: "${currentTranscript}" vs "${targetPhrase}" = ${match.toFixed(2)}`);

             if (match < 0.4) { // Menos de 40% de similaridade
                 technicalScore -= 4; // Penalidade maior
                 penalties.push(`Frase incorreta (Similaridade: ${(match*100).toFixed(0)}%)`);
             } else if (match < 0.7) {
                 technicalScore -= 2;
             }
        } else {
             // Fallback se não tiver WebSpeech (não penaliza tanto)
             console.warn("Web Speech API não suportada. Pulo validação fonética.");
        }

        // Se technicalScore ficou negativo, zera
        if (technicalScore < 0) technicalScore = 0;

        // Clamp score 0-10
        let finalStepScore = Math.max(0, Math.min(10, technicalScore));
        
        console.log("Meyda Analysis:", { avgRms, maxRms, avgZcr, durationSec, penalties, finalStepScore });

        // Armazenar temporariamente o resultado deste passo
        setCurrentStepScore(finalStepScore);
        
        // Armazenar o blob temporariamente
        setAudioBlobs(prev => ({ ...prev, [recordingStep === 3 ? 'emergency' : recordingStep]: audioBlob }));
        
        if (recordingStep === 3) {
             setPhraseAudioRecorded(true);
        }
        
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setCurrentTranscript('');
        setAudioMetrics({ rms: 0, zcr: 0 });
        
        // Mostrar tela de resultado do passo
        setShowStepResult(true);
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

      mediaRecorderRef.current.start(100); 
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

  const handleNextStep = () => {
      setScores(prev => [...prev, currentStepScore]);
      setShowStepResult(false);
      
      if (recordingStep < 3) {
          setRecordingStep(recordingStep + 1);
      } else {
          // Passo 4 (Final)
          // Calcular Score Final Médio
          const allScores = [...scores, currentStepScore];
          const avgScore = allScores.reduce((a,b) => a+b, 0) / allScores.length;
          setQualityScore(avgScore);
          setRecordingStep(4); // Tela de Score Final
      }
  };

  const handleRetryStep = () => {
      setShowStepResult(false);
      // Não avança o passo, permite gravar novamente
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

  const handleFinish = () => {
    navigate('/passenger/dashboard');
  };

  const handleSavePhrase = async () => {
    if (emergencyPhrase.trim().split(' ').length < 2) {
      alert("A frase deve ter pelo menos 2 palavras.");
      return;
    }
    
    if (!phraseAudioRecorded && !audioBlobs['emergency']) {
      alert("Você precisa gravar o áudio da frase de emergência.");
      return;
    }

    setIsSaving(true);

    try {
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

        const updateData = {
            secret_word: emergencyPhrase,
            updated_at: new Date().toISOString()
        };

        if (biometryUrls['voice_biometry_1_url']) updateData.voice_biometry_1_url = biometryUrls['voice_biometry_1_url'];
        if (biometryUrls['voice_biometry_2_url']) updateData.voice_biometry_2_url = biometryUrls['voice_biometry_2_url'];
        if (biometryUrls['voice_biometry_3_url']) updateData.voice_biometry_3_url = biometryUrls['voice_biometry_3_url'];
        if (emergencyAudioUrl) updateData.secret_word_audio_url = emergencyAudioUrl;

        await supabase.from('users').update(updateData).eq('id', user.id);
        
        const metadataUpdates = {
            emergency_phrase: emergencyPhrase,
            ...biometryUrls,
            emergency_audio_url: emergencyAudioUrl,
            voice_config_completed: true
        };

        await supabase.auth.updateUser({ data: metadataUpdates });
        
        // --- IRA-SUSI: Calcular e Salvar Baseline Médio ---
        let iraBaseline = null;
        if (baselineData.length > 0) {
            iraBaseline = {};
            ['energy', 'pitch', 'jitter', 'shimmer', 'hnr'].forEach(key => {
                 const mus = baselineData.map(d => d[key]?.mu || 0);
                 const sigmas = baselineData.map(d => d[key]?.sigma || 0);
                 iraBaseline[key] = {
                     mu: mus.reduce((a,b)=>a+b,0) / mus.length,
                     sigma: sigmas.reduce((a,b)=>a+b,0) / sigmas.length
                 };
            });
            console.log("IRA-SUSI: Salvando Baseline Personalizado:", iraBaseline);
            
            // Atualiza metadata novamente com o baseline (ou poderia ter feito antes, mas aqui é seguro)
            await supabase.auth.updateUser({ 
                data: { ...metadataUpdates, ira_baseline: iraBaseline } 
            });
        }
        
        setSuccess(true);
        alert("Configuração de voz salva com sucesso!");
        navigate('/passenger/dashboard', { replace: true });

    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar: " + error.message);
    } finally {
        setIsSaving(false);
    }
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
          <p className="text-xs text-gray-400 mb-4">Versão 1.3.15 (Calibração Estrita)</p>
          {!alreadyConfigured && recordingStep < 3 && !success && !showStepResult && (
            <p className="mt-2 text-sm text-gray-600">
              Passo {recordingStep + 1} de 4: Grave as frases indicadas para calibração.
            </p>
          )}
        </div>

        {showStepResult ? (
            <div className="text-center space-y-6">
                <h3 className="text-lg font-bold text-gray-900">Resultado da Gravação</h3>
                <div className="flex justify-center">
                    <div className={`p-6 rounded-full border-4 ${currentStepScore >= 5.0 ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}`}>
                        <span className="text-4xl font-bold">{currentStepScore.toFixed(1)}</span>
                    </div>
                </div>
                
                {currentStepScore >= 5.0 ? (
                    <p className="text-green-600 font-medium">Qualidade Aceitável</p>
                ) : (
                    <p className="text-red-600 font-medium">Qualidade Baixa - Tente falar mais claro e perto do microfone.</p>
                )}

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleNextStep}
                        className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                    >
                        {recordingStep === 3 ? 'Ver Resultado Final' : 'Próxima Frase'}
                    </button>
                    <button
                        onClick={handleRetryStep}
                        className="w-full py-3 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-medium"
                    >
                        Tentar Novamente
                    </button>
                </div>
            </div>
        ) : alreadyConfigured && !success && recordingStep === 0 ? (
            <div className="text-center space-y-6">
                <div className="flex justify-center">
                    <CheckCircle className="h-16 w-16 text-blue-500" />
                </div>
                <h3 className="text-xl font-medium text-gray-900">Voz Configurada</h3>
                <p className="text-gray-600">
                    Você já possui 4 frases gravadas e sua biometria está ativa.
                </p>
                {emergencyPhrase && (
                    <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 inline-block px-6">
                        <span className="text-xs text-yellow-600 uppercase font-bold tracking-wider">Sua Frase de Emergência:</span>
                        <p className="text-lg font-bold text-gray-800 mt-1">"{emergencyPhrase}"</p>
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleFinish}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
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
                    <div className={`p-6 rounded-full border-4 ${qualityScore >= 5.0 ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}`}>
                        <span className="text-4xl font-bold">{qualityScore.toFixed(1)}</span>
                    </div>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900">Qualidade da Gravação</h3>
                
                {qualityScore >= 5.0 ? (
                    <>
                        <p className="text-green-600 font-medium">Qualidade Aceitável.</p>
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
                        <p className="text-red-600 font-medium">Qualidade Insuficiente (Mínimo 5.0)</p>
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
            
            {/* Visualização de Nível de Áudio (VU Meter Simplificado) */}
            {isRecording && (
                <div className="flex justify-center mt-2 gap-1 h-4">
                    {[...Array(10)].map((_, i) => (
                        <div 
                            key={i} 
                            className={`w-2 rounded-full transition-all duration-75 ${
                                (audioMetrics.rms * 10) > i ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                        />
                    ))}
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
            
            {/* Visualização de Nível de Áudio (VU Meter Simplificado) */}
            {isRecording && (
                <div className="flex justify-center mt-2 gap-1 h-4">
                    {[...Array(10)].map((_, i) => (
                        <div 
                            key={i} 
                            className={`w-2 rounded-full transition-all duration-75 ${
                                (audioMetrics.rms * 10) > i ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                        />
                    ))}
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

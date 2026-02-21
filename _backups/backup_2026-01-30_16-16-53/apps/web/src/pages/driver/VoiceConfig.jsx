import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Mic, AlertCircle, PlayCircle, Square, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function VoiceConfig() {
  const [recordingStep, setRecordingStep] = useState(0); // 0, 1, 2 (Biometria), 3 (Frase Secreta)
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [emergencyPhrase, setEmergencyPhrase] = useState('');
  const [phraseAudioRecorded, setPhraseAudioRecorded] = useState(false);
  const [phraseConfirmed, setPhraseConfirmed] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  const { user, signUp } = useAuth(); // Precisamos de um método para atualizar o perfil se possível

  const handleStartRecording = () => {
    setIsRecording(true);
    // Simulação de gravação
    setTimeout(() => {
      setIsRecording(false);
      
      if (recordingStep < 3) {
        const newRecordings = [...recordings];
        newRecordings[recordingStep] = true;
        setRecordings(newRecordings);
        setRecordingStep(recordingStep + 1);
      } else {
        // Gravação da frase secreta
        setPhraseAudioRecorded(true);
      }
    }, 2000);
  };

  const handleSavePhrase = async () => {
    if (emergencyPhrase.trim().split(' ').length < 2) {
      alert("A frase deve ter pelo menos 2 palavras.");
      return;
    }
    if (!phraseAudioRecorded) {
      alert("Você precisa gravar o áudio da frase de emergência.");
      return;
    }

    // Aqui salvaríamos a frase e o áudio no backend (Supabase Storage + Users Table)
    // Simulação de salvamento
    try {
        // Atualizar o usuário real no Supabase
        const { error } = await supabase
            .from('users')
            .update({ secret_word: emergencyPhrase })
            .eq('id', user.id);

        if (error) {
            // Se falhar o update, tenta o insert (Auto-healing)
            const { error: insertError } = await supabase
                .from('users')
                .upsert({ 
                    id: user.id, 
                    email: user.email,
                    secret_word: emergencyPhrase,
                    name: user.user_metadata?.name || 'Motorista'
                });
            
            if (insertError) throw insertError;
        }
        
        // Atualizar metadados também para manter sincronia
        await supabase.auth.updateUser({
            data: { emergency_phrase: emergencyPhrase }
        });
        
        console.log("Salvando frase:", emergencyPhrase);
        console.log("Salvando áudio da frase...");
        
        setPhraseConfirmed(true);
        setSuccess(true);
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar configurações: " + error.message);
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
            <div className="p-3 bg-red-100 rounded-full">
              <Mic className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Configuração de Voz</h2>
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
            <p className="text-gray-500">Seu perfil biométrico e frase de emergência foram salvos.</p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Sua frase secreta:</p>
              <p className="text-lg font-bold text-red-600">"{emergencyPhrase}"</p>
            </div>
            <button
              onClick={handleFinish}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Ir para o Painel
            </button>
          </div>
        ) : recordingStep < 3 ? (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Frase {recordingStep + 1} de 3 (Biometria)</h3>
              <p className="text-gray-600 italic">"O sistema de segurança está ativo"</p>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleStartRecording}
                disabled={isRecording}
                className={`p-6 rounded-full transition-all ${
                  isRecording 
                    ? 'bg-red-100 text-red-600 animate-pulse' 
                    : 'bg-red-600 text-white hover:bg-red-700 shadow-lg'
                }`}
              >
                {isRecording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
            </div>

            <p className="text-center text-sm text-gray-500">
              {isRecording ? 'Gravando...' : 'Toque no microfone e leia a frase acima'}
            </p>

            <div className="flex justify-center space-x-2">
              {[0, 1, 2].map((step) => (
                <div
                  key={step}
                  className={`h-2 w-2 rounded-full ${
                    step < recordingStep || (step === recordingStep && recordings[step])
                      ? 'bg-green-500'
                      : step === recordingStep
                      ? 'bg-red-500'
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
                 className="appearance-none rounded-md block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                 placeholder="Ex: banana azul"
                 value={emergencyPhrase}
                 onChange={(e) => setEmergencyPhrase(e.target.value)}
               />
            </div>

             <div className="flex justify-center">
              <button
                onClick={handleStartRecording} // Reusando para simular a gravação da frase de confirmação
                disabled={isRecording || emergencyPhrase.length < 3}
                className={`p-4 rounded-full transition-all flex items-center space-x-2 ${
                  isRecording 
                    ? 'bg-red-100 text-red-600' 
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
                      ? 'Áudio gravado (Gravar novamente)' 
                      : 'Gravar áudio da frase (Obrigatório)'}
                </span>
              </button>
            </div>

            <button
              onClick={handleSavePhrase}
              disabled={emergencyPhrase.trim().split(' ').length < 2 || !phraseAudioRecorded}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              Salvar e Finalizar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

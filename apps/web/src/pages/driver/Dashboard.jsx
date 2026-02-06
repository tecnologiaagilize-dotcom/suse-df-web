import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, AlertTriangle, MapPin, Camera, ShieldAlert, X, Upload, Clock, Copy, Check, CheckCircle, Home } from 'lucide-react';
import TokenTimer from '../../components/common/TokenTimer';
import { supabase } from '../../lib/supabase';
import TrackingMap from '../../components/map/TrackingMap';
import VoiceEmergencyListener from '../../components/voice/VoiceEmergencyListener';

export default function DriverDashboard() {
  console.log("SUSE-DF DriverDashboard v4.1 - Merged Features (Voice + Realtime)");
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Estados principais
  const [emergencyPhrase, setEmergencyPhrase] = useState('');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState(null);
  const [trackingId, setTrackingId] = useState(null);
  
  // Estados para Encerramento Verificado
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [terminationData, setTerminationData] = useState({ photo: null, reason: '' });
  const [isTerminating, setIsTerminating] = useState(false);
  const [terminationStatus, setTerminationStatus] = useState('idle'); // idle, pending_validation, resolved_success
  const [securityToken, setSecurityToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [isTokenExpired, setIsTokenExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({ lat: -15.793889, lng: -47.882778 });

  const handleCopyToken = () => {
      if (securityToken) {
          navigator.clipboard.writeText(securityToken);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  // Carregar dados iniciais e configurar Realtime
  useEffect(() => {
    const fetchData = async () => {
        if (!user) return;
        
        // 1. Recuperar Alerta Ativo ou Recém Resolvido
        const { data: activeAlert } = await supabase
            .from('emergency_alerts')
            .select('id, status, termination_token_expires_at')
            .eq('user_id', user.id)
            .in('status', ['active', 'investigating', 'waiting_police_validation', 'resolved'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (activeAlert) {
            console.log("Alerta recuperado:", activeAlert);
            
            // Só ativa se não estiver resolvido
            if (activeAlert.status !== 'resolved') {
                setActiveAlertId(activeAlert.id);
                setIsEmergencyActive(true);
            }
            
            if (activeAlert.status === 'waiting_police_validation') {
                 setTerminationStatus('pending_validation');
                 // Tenta pegar token do banco ou local
                 const storedToken = localStorage.getItem('end_token');
                 if (storedToken) setSecurityToken(storedToken);

                 if (activeAlert.termination_token_expires_at) {
                    setTokenExpiresAt(activeAlert.termination_token_expires_at);
                    if (new Date(activeAlert.termination_token_expires_at) < new Date()) {
                        setIsTokenExpired(true);
                    }
                 }
            } else if (activeAlert.status === 'resolved') {
                // Se foi resolvido recentemente e o usuário ainda não "saiu" dessa tela, mostra o sucesso
                // Mas cuidado para não prender o usuário se ele navegar de volta
                // Vamos assumir que se ele recarregar a página e estiver resolvido, volta ao normal
                // setTerminationStatus('resolved_success'); 
                // setIsEmergencyActive(true); // Mantém a UI de emergência para mostrar o card verde
                
                // Lógica ajustada: Se resolvido, reseta para idle a menos que tenhamos um flag de sessão
                setIsEmergencyActive(false);
                setTerminationStatus('idle');
            }

            if (activeAlert.status === 'active' || activeAlert.status === 'investigating') {
                // Iniciar tracking
                const interval = setInterval(() => sendLocationUpdate(activeAlert.id), 5000);
                setTrackingId(interval);
            }
        } else {
             setIsEmergencyActive(false);
             setTerminationStatus('idle');
        }

        // 2. Recuperar Frase de Emergência
        const { data: userData } = await supabase
            .from('users')
            .select('secret_word')
            .eq('id', user.id)
            .single();
        
        setEmergencyPhrase(userData?.secret_word || user?.user_metadata?.emergency_phrase || 'socorro');
    };

    fetchData();

    // 3. Sincronização em Tempo Real (Ouvindo TODAS as mudanças no alerta do usuário)
    const subscription = supabase
      .channel(`driver_status_sync_${user.id}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'emergency_alerts',
          filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log("Mudança detectada via Realtime:", payload.new.status);
        
        if (payload.new.status === 'resolved') {
            setTerminationStatus('resolved_success');
            setIsEmergencyActive(true); // Garante que mostra o card verde
            
            // Parar rastreamento
            setTrackingId(prevId => {
                if (prevId) clearInterval(prevId);
                return null;
            });
        } else if (payload.new.status === 'active' || payload.new.status === 'investigating') {
            // Se o admin rejeitar ou mudar status, volta para o estado normal (esconde o token)
            setTerminationStatus('idle');
            setIsEmergencyActive(true);
        } else if (payload.new.status === 'waiting_police_validation') {
            setTerminationStatus('pending_validation');
        }
      })
      .subscribe();
    
    // Localização inicial
    navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, null, { enableHighAccuracy: true });

    return () => {
        subscription.unsubscribe();
        if (trackingId) clearInterval(trackingId);
    };
  }, [user]);

  const sendLocationUpdate = async (alertId) => {
    if (!alertId) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude, speed, heading, accuracy } = position.coords;
        await supabase.from('location_updates').insert([{
            alert_id: alertId,
            latitude,
            longitude,
            speed: speed || 0,
            heading: heading || 0,
            accuracy: accuracy || 0
        }]);
    }, null, { enableHighAccuracy: true, timeout: 5000 });
  };

  const handleSOS = async (trigger = 'button') => {
    try {
      let latitude = -15.793889, longitude = -47.882778;
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout: 3000}));
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch (e) {
        console.warn("GPS timeout/error, using default or last known location");
      }

      // NOVO: Usar Edge Function para robustez e auditoria
      const { data: result, error: functionError } = await supabase.functions.invoke('trigger-emergency', {
        body: {
            trigger_type: trigger === 'voice' ? 'voice' : 'button',
            latitude,
            longitude,
            notes: trigger === 'voice' ? 'Acionado por comando de voz (KWS)' : 'Acionado via botão SOS'
        }
      });

      if (functionError) {
        console.error("Edge Function Error:", functionError);
        // Fallback: Se a Edge Function falhar (offline/erro), tenta inserir direto no banco
        // Isso garante resiliência (Offline First mindset)
        console.log("Tentando fallback direto no banco...");
        return await handleSOSFallback(trigger, latitude, longitude);
      }
      
      const data = result.alert;

      setActiveAlertId(data.id);
      setIsEmergencyActive(true);
      setTerminationStatus('idle');
      
      // Iniciar Rastreamento Contínuo
      const interval = setInterval(() => sendLocationUpdate(data.id), 5000);
      setTrackingId(interval);
      
      console.log('SOS Enviado via Backend Seguro');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    } catch (error) {
      console.error("Erro ao acionar SOS:", error);
      alert('Erro ao enviar SOS: ' + error.message);
    }
  };

  // Fallback para inserção direta se a Edge Function falhar
  const handleSOSFallback = async (trigger, latitude, longitude) => {
      // 1. Auto-healing: Garantir perfil
      const { data: userProfile } = await supabase.from('users').select('id').eq('id', user.id).maybeSingle();
      if (!userProfile) {
         await supabase.from('users').insert([{
             id: user.id, email: user.email, 
             name: user.user_metadata?.name || 'Motorista', 
             phone_number: user.user_metadata?.phone_number || '00000000000',
             secret_word: 'socorro'
         }]);
      }

      const { data, error } = await supabase
        .from('emergency_alerts')
        .insert([{
            user_id: user.id,
            status: 'active',
            trigger_type: trigger === 'voice' ? 'voice' : 'button',
            initial_lat: latitude,
            initial_lng: longitude,
            notes: (trigger === 'voice' ? 'Acionado por comando de voz' : 'Acionado via botão SOS') + ' (Fallback)'
        }])
        .select().single();

      if (error) throw error;
      
      setActiveAlertId(data.id);
      setIsEmergencyActive(true);
      setTerminationStatus('idle');
      
      const interval = setInterval(() => sendLocationUpdate(data.id), 5000);
      setTrackingId(interval);
      
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  };

  const handleTerminationPhoto = (e) => {
    if (e.target.files && e.target.files[0]) {
        setTerminationData({ ...terminationData, photo: e.target.files[0] });
    }
  };

  const handleSubmitTermination = async (e) => {
      e.preventDefault();
      if (!terminationData.photo || !terminationData.reason) {
          alert("Foto e justificativa são obrigatórias.");
          return;
      }

      setIsTerminating(true);
      try {
          let photoUrl = '';
          const fileName = `termination/${activeAlertId}_${Date.now()}.jpg`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
              .from('termination-evidence') 
              .upload(fileName, terminationData.photo);
          
          if (uploadError) {
             // Fallback para avatars se o bucket principal falhar
             const backupName = `term_${activeAlertId}_${Date.now()}.jpg`;
             const { error: backupError } = await supabase.storage.from('avatars').upload(backupName, terminationData.photo);
             if (backupError) throw new Error("Falha no upload da foto: " + uploadError.message);
             const { data } = supabase.storage.from('avatars').getPublicUrl(backupName);
             photoUrl = data.publicUrl;
          } else {
             const { data } = supabase.storage.from('termination-evidence').getPublicUrl(fileName);
             photoUrl = data.publicUrl;
          }

          const { error: updateError } = await supabase
              .from('emergency_alerts')
              .update({
                  termination_photo_url: photoUrl,
                  termination_reason: terminationData.reason,
                  termination_requested_at: new Date().toISOString()
              })
              .eq('id', activeAlertId);

          if (updateError) throw new Error("Erro ao salvar justificativa: " + updateError.message);

          // Gerar Token de Segurança via RPC
          // Tenta usar token armazenado localmente primeiro para consistência
          let token;
          const storedEndToken = localStorage.getItem('end_token');
          
          if (storedEndToken) {
              await supabase.rpc('set_termination_token_manual', { p_alert_id: activeAlertId, p_token: storedEndToken });
              token = storedEndToken;
          } else {
              const { data: newToken } = await supabase.rpc('generate_termination_token', { p_alert_id: activeAlertId });
              token = newToken;
          }

          const { data: alertData } = await supabase.from('emergency_alerts').select('termination_token_expires_at').eq('id', activeAlertId).single();

          setSecurityToken(token);
          setTokenExpiresAt(alertData?.termination_token_expires_at);
          setIsTokenExpired(false);
          setTerminationStatus('pending_validation');
          setShowTerminationModal(false);

      } catch (error) {
          console.error("Erro ao enviar solicitação:", error);
          alert("Erro ao enviar solicitação: " + error.message);
      } finally {
          setIsTerminating(false);
      }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/driver/login');
  };

  const handleProfile = () => {
    navigate('/driver/profile');
  };

  return (
    <div className={`min-h-screen ${isEmergencyActive ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="text-red-600" />
                Botão de Pânico <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">v4.1</span>
              </h1>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-4">{user?.email}</span>
              <button onClick={handleSignOut} className="p-2 rounded-full text-gray-400 hover:text-gray-500">
                <LogOut className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {isEmergencyActive ? (
             <div className="flex flex-col items-center justify-center space-y-8 h-[60vh]">
                {/* Modo Discreto / Camuflado */}
                <div className="text-center text-gray-400 w-full max-w-md mx-auto">
                    <p className="text-4xl font-mono">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    <p className="text-sm mt-2">Sistema em Standby</p>
                    
                    {(terminationStatus === 'pending_validation' || terminationStatus === 'resolved_success') && (
                        <div className={`mt-8 p-6 rounded-xl border-2 transition-all duration-500 ${
                            terminationStatus === 'resolved_success' 
                            ? 'bg-green-900/40 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
                            : 'bg-yellow-900/40 border-yellow-600/50 animate-pulse'
                        }`}>
                            {terminationStatus === 'resolved_success' ? (
                                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                            ) : (
                                <ShieldAlert className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                            )}
                            
                            <p className={`font-bold uppercase text-xl tracking-wide ${
                                terminationStatus === 'resolved_success' ? 'text-green-500' : 'text-yellow-500'
                            }`}>
                                {terminationStatus === 'resolved_success' ? 'Ocorrência finalizada pela central de monitoramento' : 'Aguardando Validação'}
                            </p>
                            
                            {terminationStatus === 'resolved_success' ? (
                                <div className="my-6">
                                    <button 
                                        onClick={() => {
                                            setIsEmergencyActive(false);
                                            setTerminationStatus('idle');
                                            setActiveAlertId(null);
                                        }}
                                        className="w-full py-5 px-6 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3"
                                    >
                                        <Home size={24} /> Voltar para o painel do motorista
                                    </button>
                                </div>
                            ) : securityToken ? (
                                <div className="bg-black/60 p-6 rounded-lg my-6 border border-yellow-500/30 shadow-lg relative overflow-hidden flex flex-col items-center">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent animate-shimmer"></div>
                                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Token de Segurança</p>
                                    <div className="flex items-center gap-3">
                                        <p className={`text-5xl font-mono font-bold tracking-widest select-all ${isTokenExpired ? 'text-gray-500 line-through' : 'text-white'}`}>{securityToken}</p>
                                        {!isTokenExpired && (
                                            <button 
                                                onClick={handleCopyToken}
                                                className="bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-500 p-2 rounded-full transition-colors"
                                            >
                                                {copied ? <Check size={24} /> : <Copy size={24} />}
                                            </button>
                                        )}
                                    </div>
                                    
                                    {tokenExpiresAt && !isTokenExpired && (
                                        <TokenTimer 
                                            expiresAt={tokenExpiresAt} 
                                            onExpire={() => setIsTokenExpired(true)} 
                                        />
                                    )}

                                    {isTokenExpired && (
                                        <div className="mt-4 bg-red-600/80 text-white p-2 rounded text-xs font-bold uppercase tracking-wider">
                                            Token Expirado
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-red-900/50 p-4 rounded-lg my-6 border border-red-500 text-center">
                                    <p className="text-white font-bold mb-2">Token não encontrado</p>
                                    <p className="text-xs text-red-200 mb-4">Você recarregou a página e o token de segurança temporário foi perdido.</p>
                                    <button 
                                        onClick={() => setShowTerminationModal(true)}
                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold"
                                    >
                                        Gerar Novo Token
                                    </button>
                                </div>
                            )}

                            {terminationStatus !== 'resolved_success' && (
                                <div className="text-left bg-yellow-900/30 p-4 rounded text-sm text-yellow-100 space-y-2 border border-yellow-800">
                                    <p className="font-bold flex items-center gap-2"><MapPin size={16}/> Instruções:</p>
                                    <ol className="list-decimal pl-5 space-y-1">
                                        <li>Dirija-se a um posto policial ou delegacia.</li>
                                        <li>Solicite ao agente que contate a Central.</li>
                                        <li>Informe o <strong>Token</strong> acima para validação.</li>
                                    </ol>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {terminationStatus === 'idle' && (
                    <button 
                       onClick={() => setShowTerminationModal(true)}
                       className="mt-8 px-6 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg flex items-center gap-2"
                    >
                       <CheckCircle size={20} /> Finalizar Ocorrência
                    </button>
                )}
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900">Painel do Condutor</h2>
                  <p className="mt-1 text-gray-500">Em caso de emergência, pressione o botão abaixo.</p>

                  {/* Monitoramento de Voz Ativo */}
                  <div className="mt-4 flex justify-center">
                    <VoiceEmergencyListener 
                      emergencyPhrase={emergencyPhrase}
                      isActive={!isEmergencyActive} // Só escuta se não estiver em emergência
                      onEmergencyDetected={() => {
                        console.log("Emergência por voz detectada!");
                        handleSOS('voice');
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleSOS('button')}
                  className="w-64 h-64 bg-red-600 rounded-full flex flex-col items-center justify-center shadow-lg border-8 border-red-500 hover:bg-red-700 active:bg-red-800 transition-colors"
                >
                  <AlertTriangle className="h-24 w-24 text-white mb-2" />
                  <span className="text-4xl font-bold text-white">SOS</span>
                </button>

                <div className="w-full max-w-md flex justify-center">
                  <button 
                    onClick={handleProfile}
                    className="text-blue-600 hover:text-blue-800 underline font-medium"
                  >
                    Meu Cadastro - Clique Aqui
                  </button>
                </div>

                <div className="bg-white p-6 rounded-lg shadow w-full max-w-md">
                  <div className="flex items-center space-x-4 mb-4">
                    <MapPin className="h-6 w-6 text-blue-500" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Localização Atual</h3>
                      <p className="text-sm text-gray-500">Latitude: {currentLocation.lat.toFixed(6)}</p>
                      <p className="text-sm text-gray-500">Longitude: {currentLocation.lng.toFixed(6)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    Sua localização está sendo monitorada para sua segurança.
                  </p>
                </div>
             </div>
          )}
        </div>
      </main>

      {/* Modal de Encerramento Verificado */}
      {showTerminationModal && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-lg overflow-hidden shadow-2xl">
                  <div className="bg-red-600 text-white p-4 flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2">
                          <ShieldAlert size={20} /> Encerrar Monitoramento
                      </h3>
                      <button onClick={() => setShowTerminationModal(false)} className="text-white/80 hover:text-white">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSubmitTermination} className="p-6 space-y-6">
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
                          <p className="font-bold">Protocolo de Segurança Ativo</p>
                          <p>Para sua segurança, o encerramento definitivo requer validação visual e justificativa.</p>
                      </div>

                      {/* Passo 1: Foto */}
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                              1. Validação Visual (Obrigatório)
                          </label>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 relative">
                              <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="user"
                                  onChange={handleTerminationPhoto}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                              />
                              {terminationData.photo ? (
                                  <div className="flex flex-col items-center">
                                      <p className="text-green-600 font-bold flex items-center gap-2">
                                          <Camera size={20} /> Foto Capturada
                                      </p>
                                      <p className="text-xs text-gray-500 mt-1">{terminationData.photo.name}</p>
                                      <button type="button" className="text-xs text-blue-600 underline mt-2">Tirar outra</button>
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-center text-gray-500">
                                      <Camera size={32} className="mb-2" />
                                      <p className="font-medium">Toque para tirar uma foto do seu rosto</p>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Passo 2: Justificativa */}
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                              2. Justificativa (Obrigatório)
                          </label>
                          <textarea 
                              required
                              rows={3}
                              placeholder="Por que deseja encerrar o monitoramento?"
                              value={terminationData.reason}
                              onChange={(e) => setTerminationData({...terminationData, reason: e.target.value})}
                              className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 border p-2"
                          />
                      </div>

                      <div className="pt-4 flex gap-3">
                          <button 
                              type="button"
                              onClick={() => setShowTerminationModal(false)}
                              className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
                          >
                              Cancelar
                          </button>
                          <button 
                              type="submit"
                              disabled={isTerminating || !terminationData.photo || !terminationData.reason}
                              className="flex-1 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 flex justify-center items-center gap-2"
                          >
                              {isTerminating ? (
                                  <>
                                      <Upload size={18} className="animate-spin" /> Enviando...
                                  </>
                              ) : 'Enviar e Validar'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}

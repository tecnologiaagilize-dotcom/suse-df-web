import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, AlertTriangle, MapPin, Camera, ShieldAlert, X, Upload, Check, CheckCircle, Home, User, Activity, HeartPulse, Copy } from 'lucide-react';
import TokenTimer from '../../components/common/TokenTimer';
import { supabase } from '../../lib/supabase';
import VoiceEmergencyListener from '../../components/voice/VoiceEmergencyListener';
import IraDebugPanel from '../../components/debug/IraDebugPanel';
import OfflineQueueService from '../../services/OfflineQueueService';
import GeofenceModal from '../../components/GeofenceModal';

export default function PassengerDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Estado para Modal de Cerca Virtual
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);

  // Estados de Emergência e Alerta
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState(null);
  const [terminationStatus, setTerminationStatus] = useState('idle'); // 'idle', 'pending_validation', 'resolved_success'
  const [trackingId, setTrackingId] = useState(null);
  
  // Estados de Localização
  const [currentLocation, setCurrentLocation] = useState({ lat: -15.793889, lng: -47.882778 }); // Padrão: Brasília
  
  // Estados para Finalização e Modais
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [isTerminating, setIsTerminating] = useState(false);
  const [terminationData, setTerminationData] = useState({ photo: null, reason: '' });
  
  // Estados de Voz e Token de Segurança
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [emergencyPhrase, setEmergencyPhrase] = useState('socorro'); // Inicializa com padrão, depois busca do banco
  const [securityToken, setSecurityToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [isTokenExpired, setIsTokenExpired] = useState(false);
  const [copied, setCopied] = useState(false);

  // Estado para Monitoramento IRA-SUSI (Visualização Fixa)
  const [iraData, setIraData] = useState(null);

  // Função auxiliar para copiar token
  const handleCopyToken = () => {
    if (securityToken) {
      navigator.clipboard.writeText(securityToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRegenerateToken = async () => {
      if (!activeAlertId) return;
      
      try {
          // Gerar novo token sem pedir foto novamente
          const { data: newToken, error } = await supabase.rpc('generate_termination_token', { p_alert_id: activeAlertId });
          
          if (error) throw error;
          
          const { data: alertData } = await supabase.from('emergency_alerts').select('termination_token_expires_at').eq('id', activeAlertId).single();

          setSecurityToken(newToken);
          setTokenExpiresAt(alertData?.termination_token_expires_at);
          setIsTokenExpired(false);
          alert("Novo token gerado com sucesso!");
          
      } catch (error) {
          console.error("Erro ao regenerar token:", error);
          alert("Erro ao gerar novo token: " + error.message);
      }
  };

  // Função para enviar atualização de localização (Rastreamento)
  const sendLocationUpdate = async (alertId) => {
    if (!alertId) return;
    
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });

        const { latitude, longitude, speed, heading, accuracy } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });

        // Enviar para tabela de rastreamento (location_updates)
        const { error } = await supabase.from('location_updates').insert({
            alert_id: alertId,
            latitude,
            longitude,
            speed: speed || 0,
            heading: heading || 0,
            accuracy: accuracy || 0
        });
        
        if (error) console.error("Erro silencioso ao atualizar localização:", error);
        
    } catch (err) {
        console.error("Erro GPS ao atualizar localização:", err);
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
        
        if (userData?.secret_word) {
            setEmergencyPhrase(userData.secret_word);
        } else if (user?.user_metadata?.emergency_phrase) {
            setEmergencyPhrase(user.user_metadata.emergency_phrase);
        }
    };

    fetchData();

    // 3. Sincronização em Tempo Real
    const subscription = supabase
      .channel(`passenger_status_sync_${user.id}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'emergency_alerts',
          filter: `user_id=eq.${user.id}`
      }, (payload) => {
        
        if (payload.new.status === 'resolved') {
            setIsEmergencyActive(false);
            setTerminationStatus('idle');
            setActiveAlertId(null);
            
            // Parar rastreamento
            setTrackingId(prevId => {
                if (prevId) clearInterval(prevId);
                return null;
            });
        } else if (payload.new.status === 'active' || payload.new.status === 'investigating') {
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

  // Efeito para monitorar status online/offline
  useEffect(() => {
    const handleOnline = () => {
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        OfflineQueueService.processQueue();
    };

    window.addEventListener('online', handleOnline);
    OfflineQueueService.processQueue();

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // 4. Polling de Segurança
  useEffect(() => {
      let pollInterval;
      
      if (isEmergencyActive && activeAlertId) {
          pollInterval = setInterval(async () => {
              try {
                  const { data } = await supabase
                      .from('emergency_alerts')
                      .select('status')
                      .eq('id', activeAlertId)
                      .single();

                  if (data && data.status === 'resolved') {
                      setIsEmergencyActive(false);
                      setTerminationStatus('idle');
                      setActiveAlertId(null);
                      
                      setTrackingId(prev => {
                          if (prev) clearInterval(prev);
                          return null;
                      });
                  }
              } catch (err) {
                  console.error("Erro no polling:", err);
              }
          }, 3000);
      }

      return () => {
          if (pollInterval) clearInterval(pollInterval);
      };
  }, [isEmergencyActive, activeAlertId]);

  const handleSOS = async (trigger = 'button') => {
    if (isEmergencyActive) return;

    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      
      let latitude = -15.793889; 
      let longitude = -47.882778;

      try {
        const pos = await new Promise((res, rej) => 
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, enableHighAccuracy: true })
        );
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch (gpsError) {
         if (currentLocation && currentLocation.lat) {
            latitude = currentLocation.lat;
            longitude = currentLocation.lng;
         }
      }

      if (!navigator.onLine) {
          OfflineQueueService.enqueueAlert({
              trigger_type: trigger === 'voice' ? 'voice' : 'button',
              latitude,
              longitude,
              notes: trigger === 'voice' ? 'Acionado por voz (Offline)' : 'Botão SOS (Offline)'
          });
          
          setIsEmergencyActive(true);
          setTerminationStatus('idle');
          alert("Sem conexão com a internet. O alerta foi salvo e será enviado assim que o sinal voltar.");
          return;
      }

      const { data: result, error: rpcError } = await supabase.rpc('trigger_emergency_rpc', {
        p_trigger_type: trigger === 'voice' ? 'voice' : 'button',
        p_latitude: latitude,
        p_longitude: longitude,
        p_notes: trigger === 'voice' ? 'Acionado por comando de voz (KWS)' : 'Acionado via botão SOS'
      });

      if (rpcError) {
        if (rpcError.message && (rpcError.message.includes('fetch') || rpcError.message.includes('network'))) {
             OfflineQueueService.enqueueAlert({
                  trigger_type: trigger === 'voice' ? 'voice' : 'button',
                  latitude,
                  longitude,
                  notes: 'Falha de rede no envio (Fallback Offline)'
             });
             setIsEmergencyActive(true);
             alert("Erro de conexão. Alerta salvo para envio automático.");
             return;
        }
        // Fallback implementation would go here (omitted for brevity, same as driver)
        throw rpcError;
      }
      
      if (result.already_active) {
          setActiveAlertId(result.alert.id);
          setIsEmergencyActive(true);
          setTerminationStatus('idle');
          
          if (trackingId) clearInterval(trackingId);
          const interval = setInterval(() => sendLocationUpdate(result.alert.id), 5000);
          setTrackingId(interval);
          
          alert("Atenção: Você já possui um chamado de emergência em andamento.");
          return;
      }
      
      const data = result.alert;
      setActiveAlertId(data.id);
      setIsEmergencyActive(true);
      setTerminationStatus('idle');
      
      const interval = setInterval(() => sendLocationUpdate(data.id), 5000);
      setTrackingId(interval);
      
    } catch (error) {
      console.error("Erro ao acionar SOS:", error);
      alert('Erro ao enviar SOS: ' + error.message);
    }
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
          
          const { error: uploadError } = await supabase.storage
              .from('termination-evidence') 
              .upload(fileName, terminationData.photo);
          
          if (uploadError) {
             const backupName = `term_${activeAlertId}_${Date.now()}.jpg`;
             await supabase.storage.from('avatars').upload(backupName, terminationData.photo);
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
    navigate('/passenger/login');
  };

  const handleProfile = () => {
    navigate('/passenger/profile');
  };

  return (
    <div className={`min-h-screen ${isEmergencyActive ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="text-red-600" />
                SUSE - Passageiro
              </h1>
              <span className="text-xs text-gray-500 font-mono ml-8">v1.3.1</span>
            </div>
            <div className="flex items-center gap-4">
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
                                {terminationStatus === 'resolved_success' ? 'Ocorrência finalizada pela central' : 'Aguardando Validação'}
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
                                        <Home size={24} /> Voltar para o painel
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
                                        onClick={handleRegenerateToken}
                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold shadow-md active:scale-95 transition-transform"
                                    >
                                        Gerar Novo Token
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="mt-8 w-full max-w-xs flex flex-col gap-3">
                    {terminationStatus === 'idle' && (
                        <button 
                           onClick={() => setShowTerminationModal(true)}
                           className="w-full px-6 py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-colors shadow-lg flex items-center justify-center gap-3 uppercase tracking-wider"
                        >
                           <CheckCircle size={24} /> Finalizar Ocorrência
                        </button>
                    )}
                </div>
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900">Painel do Passageiro</h2>
                  <p className="mt-1 text-gray-500">Em caso de emergência, pressione o botão abaixo.</p>

                  <div className="mt-4 flex justify-center">
                    <VoiceEmergencyListener 
                      emergencyPhrase={emergencyPhrase}
                      isActive={!isEmergencyActive} 
                      onTranscriptChange={(text) => setVoiceTranscript(text)}
                      onAnalysisUpdate={(data) => setIraData(data)} // Atualiza o painel fixo
                      showDebugPanel={false} // Esconde o painel flutuante
                      onEmergencyDetected={() => {
                        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        handleSOS('voice');
                      }}
                    />
                    
                    {voiceTranscript && !isEmergencyActive && (
                        <div className="mt-2 text-xs text-center text-gray-500 italic animate-pulse">
                            Ouvindo: "{voiceTranscript}..."
                        </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleSOS('button')}
                  className="w-64 h-64 bg-red-600 rounded-full flex flex-col items-center justify-center shadow-lg border-8 border-red-500 hover:bg-red-700 active:bg-red-800 transition-colors"
                >
                  <AlertTriangle className="h-24 w-24 text-white mb-2" />
                  <span className="text-4xl font-bold text-white">SOS</span>
                </button>

                <div className="w-full max-w-md flex flex-col gap-3 justify-center items-center">
                  <button 
                    onClick={() => setShowGeofenceModal(true)}
                    className="w-full flex items-center justify-center gap-2 text-green-600 hover:text-green-800 font-medium bg-green-50 px-4 py-2 rounded-full border border-green-200"
                  >
                    <MapPin size={18} /> Definir Área de Segurança (Cerca Virtual)
                  </button>

                  <button 
                    onClick={handleProfile}
                    className="w-full flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-4 py-2 rounded-full border border-blue-200"
                  >
                    <User size={18} /> Meu Cadastro
                  </button>
                  
                  <button 
                    onClick={() => navigate('/passenger/voice-config')}
                    className="w-full flex items-center justify-center gap-2 text-purple-600 hover:text-purple-800 font-medium bg-purple-50 px-4 py-2 rounded-full border border-purple-200"
                  >
                    <Activity size={18} /> Configurar Voz
                  </button>

                  <button 
                    onClick={() => navigate('/passenger/health')}
                    className="w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-800 font-medium bg-red-50 px-4 py-2 rounded-full border border-red-200"
                  >
                    <HeartPulse size={18} /> Minha Saúde
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

                {/* Painel IRA-SUSI Fixo - STATUS */}
                <div className="w-full max-w-md bg-gray-900 rounded-lg p-4 shadow-lg border border-gray-700">
                     <h4 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3 border-b border-gray-700 pb-2">
                         Status IRA-SUSE™
                     </h4>
                     
                     <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                             <span className="text-xs text-gray-500">Nível de Risco</span>
                             <span className={`text-2xl font-black ${
                                 iraData?.status === 'EMERGENCIA' ? 'text-red-500 animate-pulse' :
                                 iraData?.status === 'RISCO' ? 'text-orange-500' :
                                 iraData?.status === 'ATENCAO' ? 'text-yellow-500' :
                                 'text-green-500'
                             }`}>
                                 {iraData?.status || 'NORMAL'}
                             </span>
                         </div>
                         
                         <div className="text-right">
                             <span className="text-xs text-gray-500 block">Score Acústico</span>
                             <span className="text-xl font-mono text-white">
                                 {iraData?.ira ? (iraData.ira * 100).toFixed(0) : '0'}%
                             </span>
                         </div>
                     </div>

                     {/* Barra de Progresso do Risco */}
                     <div className="w-full bg-gray-800 h-2 rounded-full mt-3 overflow-hidden">
                         <div 
                            className={`h-full transition-all duration-500 ${
                                iraData?.status === 'EMERGENCIA' ? 'bg-red-600' :
                                iraData?.status === 'RISCO' ? 'bg-orange-500' :
                                iraData?.status === 'ATENCAO' ? 'bg-yellow-500' :
                                'bg-green-500'
                            }`}
                            style={{ width: `${(iraData?.ira || 0) * 100}%` }}
                         ></div>
                     </div>
                </div>

                {/* Painel Debug (Expandível se necessário, mas mantido discreto) */}
                <div className="w-full max-w-md hidden">
                    <IraDebugPanel data={iraData} mode="embed" />
                </div>
             </div>
          )}
        </div>
      </main>

      {/* Modal de Cerca Virtual */}
      <GeofenceModal 
        isOpen={showGeofenceModal} 
        onClose={() => setShowGeofenceModal(false)}
        userId={user?.id}
      />

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
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-center text-gray-500">
                                      <Camera size={32} className="mb-2" />
                                      <p className="font-medium">Toque para tirar uma foto</p>
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

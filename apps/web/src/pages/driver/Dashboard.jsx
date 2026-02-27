import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, AlertTriangle, MapPin, Camera, ShieldAlert, X, Upload, Clock, Copy, Check, CheckCircle, Home, User, HeartPulse, Share2 } from 'lucide-react';
import TokenTimer from '../../components/common/TokenTimer';
import { supabase } from '../../lib/supabase';
import TrackingMap from '../../components/map/TrackingMap';
import VoiceEmergencyListener from '../../components/voice/VoiceEmergencyListener';
import IraDebugPanel from '../../components/debug/IraDebugPanel';
import OfflineQueueService from '../../services/OfflineQueueService';

import GeofenceModal from '../../components/GeofenceModal';

export default function DriverDashboard() {
  console.log("SUSE-DF DriverDashboard V1.3.7 - Compact Map");
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
            console.log("Alerta resolvido remotamente. Resetando para Standby.");
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

  // Efeito para monitorar status online/offline e processar fila
  useEffect(() => {
    const handleOnline = () => {
        console.log("Conexão restaurada! Verificando fila offline...");
        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        OfflineQueueService.processQueue();
    };

    window.addEventListener('online', handleOnline);
    
    // Tenta processar ao carregar, caso já tenha voltado
    OfflineQueueService.processQueue();

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // 4. Polling de Segurança (Fallback para Realtime)
  // Garante que o app detecte o encerramento mesmo se o WebSocket falhar
  useEffect(() => {
      let pollInterval;
      
      if (isEmergencyActive && activeAlertId) {
          console.log("Polling ativo para alerta:", activeAlertId);
          pollInterval = setInterval(async () => {
              try {
                  // Verifica status atual no banco
                  const { data, error } = await supabase
                      .from('emergency_alerts')
                      .select('status')
                      .eq('id', activeAlertId)
                      .single();

                  if (data && data.status === 'resolved') {
                      console.log("Polling detectou resolução. Resetando para Standby.");
                      setIsEmergencyActive(false);
                      setTerminationStatus('idle');
                      setActiveAlertId(null);
                      
                      // Garante parada do tracking
                      setTrackingId(prev => {
                          if (prev) clearInterval(prev);
                          return null;
                      });
                  }
              } catch (err) {
                  console.error("Erro no polling:", err);
              }
          }, 3000); // Verifica a cada 3 segundos
      }

      return () => {
          if (pollInterval) clearInterval(pollInterval);
      };
  }, [isEmergencyActive, activeAlertId]);

  // ... (dentro de handleSOS)
  const handleSOS = async (trigger = 'button', reason = null) => {
    // Bloqueio Preventivo no Frontend
    if (isEmergencyActive) {
        console.warn("SOS já ativo. Bloqueando nova chamada.");
        return;
    }

    // Reforço de Mensagem via WhatsApp em caso de impacto
    if (reason && reason.includes('IMPACTO')) {
        console.warn("ALERTA CRÍTICO: Impacto detectado. Solicitando envio de WhatsApp prioritário.");
    }

    try {
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      
      // 1. Obter Localização (mantém lógica existente)
      let latitude = -15.793889; 
      let longitude = -47.882778;
      // ... (lógica de GPS mantida) ...
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

      // Define notas com base no trigger e reason
      let notes = trigger === 'voice' ? 'Acionado por comando de voz (KWS)' : 'Acionado via botão SOS';
      if (reason) {
          notes += ` [MOTIVO: ${reason}]`;
          if (reason.includes('IMPACTO')) {
              notes += " - ENVIAR WHATSAPP URGENTE";
          }
      }

      // Verificação de Conexão ANTES de tentar RPC
      if (!navigator.onLine) {
          console.warn("Sem internet. Salvando alerta na fila offline.");
          OfflineQueueService.enqueueAlert({
              trigger_type: trigger === 'voice' ? 'voice' : 'button',
              latitude,
              longitude,
              notes: notes + ' (Offline)'
          });
          
          // Simula sucesso visual para acalmar o motorista
          setIsEmergencyActive(true);
          setTerminationStatus('idle');
          alert("Sem conexão com a internet. O alerta foi salvo e será enviado assim que o sinal voltar.");
          return;
      }

      // NOVO: Usar RPC V2
      const { data: result, error: rpcError } = await supabase.rpc('trigger_emergency_rpc', {
        p_trigger_type: trigger === 'voice' ? 'voice' : 'button',
        p_latitude: latitude,
        p_longitude: longitude,
        p_notes: notes
      });

      if (rpcError) {
        console.error("RPC Error:", rpcError);
        
        // Se o erro for de rede (fetch failed), salva na fila
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

        return await handleSOSFallback(trigger, latitude, longitude, notes);
      }
      
      // ... (restante do código de sucesso)

      
      // Se o backend disser que já existe, usamos o alerta existente
      if (result.already_active) {
          console.log("Alerta já existente recuperado:", result.alert.id);
          setActiveAlertId(result.alert.id);
          setIsEmergencyActive(true);
          setTerminationStatus('idle');
          
          // Reinicia rastreamento só para garantir
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
      
      // Iniciar Rastreamento Contínuo
      const interval = setInterval(() => sendLocationUpdate(data.id), 5000);
      setTrackingId(interval);
      
      console.log('SOS Enviado com Sucesso');

    } catch (error) {
      console.error("Erro ao acionar SOS:", error);
      alert('Erro ao enviar SOS: ' + error.message);
    }
  };

  // Fallback para inserção direta se a Edge Function falhar
  const handleSOSFallback = async (trigger, latitude, longitude, notes = null) => {
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

      const finalNotes = notes || ((trigger === 'voice' ? 'Acionado por comando de voz' : 'Acionado via botão SOS') + ' (Fallback)');

      const { data, error } = await supabase
        .from('emergency_alerts')
        .insert([{
            user_id: user.id,
            status: 'active',
            trigger_type: trigger === 'voice' ? 'voice' : 'button',
            initial_lat: latitude,
            initial_lng: longitude,
            notes: finalNotes
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

  // Função para compartilhar localização
  const handleShareLocation = async () => {
    const shareUrl = `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lng}`;
    const shareData = {
        title: 'Minha Localização - SUSE',
        text: 'Estou usando o SUSE. Acompanhe minha localização:',
        url: shareUrl
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
        } catch (err) {
            console.log('Compartilhamento cancelado ou falhou:', err);
        }
    } else {
        navigator.clipboard.writeText(shareUrl);
        alert('Link de localização copiado para a área de transferência!');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/driver/login');
  };

  const handleProfile = () => {
    navigate('/driver/profile');
  };

  const handleVoiceConfig = () => {
    navigate('/driver/voice-config');
  };

  const handleHealth = () => {
    navigate('/driver/health');
  };

  return (
    <div className={`min-h-screen ${isEmergencyActive ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="text-red-600" />
                SUSE - Motorista
              </h1>
              <span className="text-xs text-gray-500 font-mono ml-8">v1.3</span>
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
                                        onClick={handleRegenerateToken}
                                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold shadow-md active:scale-95 transition-transform"
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
                    <div className="w-full max-w-xs mt-8">
                        <button 
                           onClick={() => setShowTerminationModal(true)}
                           className="w-full px-6 py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-colors shadow-lg flex items-center justify-center gap-3 uppercase tracking-wider"
                        >
                           <CheckCircle size={24} /> Finalizar Ocorrência
                        </button>
                    </div>
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
                      onTranscriptChange={(text) => setVoiceTranscript(text)}
                      onAnalysisUpdate={(data) => setIraData(data)} // Atualiza o painel fixo
                      showDebugPanel={false} // Esconde o painel flutuante
                      onEmergencyDetected={(reason) => {
                        // Feedback imediato antes mesmo de chamar o backend
                        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        console.log(`Emergência por voz detectada! Motivo: ${reason || 'Desconhecido'}`);
                        handleSOS('voice', reason);
                      }}
                    />
                    
                    {/* Exibir o que está sendo ouvido (Feedback Visual) */}
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
                    className="w-full flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-4 py-2 rounded-full border border-blue-200"
                  >
                    <MapPin size={18} /> Definir Área de Atuação (Cerca Virtual)
                  </button>
                  
                  <button 
                    onClick={handleProfile}
                    className="w-full flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-4 py-2 rounded-full border border-blue-200"
                  >
                    <User size={18} /> Meu Cadastro
                  </button>

                  <button 
                    onClick={handleVoiceConfig}
                    className="w-full flex items-center justify-center gap-2 text-purple-600 hover:text-purple-800 font-medium bg-purple-50 px-4 py-2 rounded-full border border-purple-200"
                  >
                    <Clock size={18} /> Configurar Voz
                  </button>

                  <button 
                    onClick={handleHealth}
                    className="w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-800 font-medium bg-red-50 px-4 py-2 rounded-full border border-red-200"
                  >
                    <HeartPulse size={18} /> Minha Saúde
                  </button>
                </div>

                <div className="w-full max-w-md bg-white rounded-lg shadow-lg overflow-hidden flex flex-col border border-gray-200">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <MapPin className="text-blue-600" size={20} /> Localização Atual
                    </h3>
                    <span className="text-xs font-mono text-gray-400 bg-white px-2 py-1 rounded border border-gray-200">
                      {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                    </span>
                  </div>
                  
                  {/* Mapa Visível - Altura reduzida (1/3) */}
                  <div className="h-32 w-full relative bg-gray-100 z-0">
                     <TrackingMap lat={currentLocation.lat} lng={currentLocation.lng} />
                  </div>

                  {/* Botão de Compartilhamento */}
                  <div className="p-4 bg-white border-t border-gray-100">
                      <button 
                          onClick={handleShareLocation}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-wide text-sm"
                      >
                          <Share2 size={18} /> Compartilhar Geolocalização
                      </button>
                      <p className="text-[10px] text-gray-400 text-center mt-2">
                          Compartilhe com um contato de emergência ou adicione um novo.
                      </p>
                  </div>
                </div>

                {/* Painel IRA-SUSI Fixo - STATUS */}
                <div className="w-full max-w-md bg-gray-900 rounded-lg p-4 shadow-lg border border-gray-700">
                     <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2">
                        <h4 className="text-gray-400 text-xs uppercase tracking-widest font-bold">
                            Status IRA-SUSE™ <span className="text-gray-600 ml-1">v1.1</span>
                        </h4>
                        {/* Indicador de Atividade do Microfone */}
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${iraData ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                            <span className="text-[10px] text-gray-500 font-mono">
                                {iraData ? 'MIC ON' : 'MIC OFF'}
                            </span>
                        </div>
                     </div>
                     
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

                     {/* Barra de Monitoramento com Níveis Fixos e Marcador Móvel - v3.0 */}
                     <div className="mt-4 mb-4">
                         <div className="flex justify-between text-[10px] text-gray-500 mb-1 font-bold uppercase">
                             <span>Nível de Monitoramento</span>
                             <span className={
                                 (iraData?.ira || 0) > 0.80 ? 'text-red-500' : 
                                 (iraData?.ira || 0) > 0.40 ? 'text-yellow-500' : 'text-green-500'
                             }>
                                 {iraData?.status || 'NORMAL'}
                             </span>
                         </div>
                         
                         {/* Container da Barra */}
                         <div className="w-full h-6 rounded-full overflow-hidden border border-gray-700 relative bg-gray-900 shadow-inner">
                             
                             {/* Fundo Colorido Fixo (Zonas de Risco Separadas) */}
                             <div className="absolute inset-0 flex w-full h-full opacity-90">
                                 <div className="h-full bg-green-600 w-[40%] border-r border-gray-900/30 flex items-center justify-center text-[9px] font-bold text-green-950/50"></div>
                                 <div className="h-full bg-yellow-500 w-[35%] border-r border-gray-900/30 flex items-center justify-center text-[9px] font-bold text-yellow-950/50"></div>
                                 <div className="h-full bg-red-600 w-[25%] flex items-center justify-center text-[9px] font-bold text-red-950/50"></div>
                             </div>

                             {/* Marcador/Agulha que se movimenta */}
                             <div 
                                className="absolute top-0 bottom-0 w-2 bg-white shadow-[0_0_15px_rgba(255,255,255,1)] z-20 transition-all duration-300 ease-out transform -translate-x-1/2 border-x border-gray-400"
                                style={{ left: `${Math.min(100, (iraData?.ira || 0) * 100)}%` }}
                             ></div>
                         </div>
                         
                         {/* Labels das Zonas */}
                         <div className="flex justify-between text-[8px] text-gray-600 mt-1 px-1 font-mono uppercase">
                             <span>Seguro (0-40%)</span>
                             <span className="text-center">Atenção</span>
                             <span className="text-right">Risco Crítico</span>
                         </div>
                         
                         {(iraData?.ira || 0) > 0.88 && (
                             <p className="text-[10px] text-red-500 text-center mt-2 animate-pulse font-bold tracking-widest border border-red-500/50 rounded bg-red-900/20 py-1">
                                 ⚠️ ACIONAMENTO IMINENTE
                             </p>
                         )}
                     </div>

                     {/* Indicadores Detalhados de Ruído (Telemetry) */}
                     <div className="grid grid-cols-3 gap-2 border-t border-gray-700 pt-3">
                         <div className="bg-gray-800/50 p-2 rounded border border-gray-600/50 flex flex-col items-center">
                             <span className="text-[9px] text-gray-400 uppercase tracking-wider">Volume (RMS)</span>
                             <span className="text-sm font-mono font-bold text-white">
                                 {(iraData?.features?.rms || 0).toFixed(3)}
                             </span>
                         </div>
                         <div className="bg-gray-800/50 p-2 rounded border border-gray-600/50 flex flex-col items-center">
                             <span className="text-[9px] text-gray-400 uppercase tracking-wider">Frequência</span>
                             <span className="text-sm font-mono font-bold text-white">
                                 {(iraData?.features?.pitch || 0).toFixed(0)} <span className="text-[9px] text-gray-500">Hz</span>
                             </span>
                         </div>
                         <div className="bg-gray-800/50 p-2 rounded border border-gray-600/50 flex flex-col items-center">
                             <span className="text-[9px] text-gray-400 uppercase tracking-wider">Estabilidade</span>
                             <span className={`text-sm font-mono font-bold ${
                                 (iraData?.features?.jitter || 0) > 0.1 ? 'text-red-400' : 'text-green-400'
                             }`}>
                                 {((1 - (iraData?.features?.jitter || 0)) * 100).toFixed(0)}%
                             </span>
                         </div>
                         
                         {/* Linha 2: Sensores Físicos (Adicionado v2.3) */}
                         <div className={`bg-gray-800/50 p-2 rounded border border-gray-600/50 flex flex-col items-center ${iraData?.context?.impactDetected ? 'bg-red-900/50 border-red-500 animate-pulse' : ''}`}>
                             <span className="text-[9px] text-gray-400 uppercase tracking-wider">Colisão</span>
                             <span className={`text-sm font-mono font-bold ${iraData?.context?.impactDetected ? 'text-red-500' : 'text-green-500'}`}>
                                 {iraData?.context?.impactDetected ? 'DETECTADO' : 'OK'}
                             </span>
                         </div>
                         <div className="bg-gray-800/50 p-2 rounded border border-gray-600/50 flex flex-col items-center">
                             <span className="text-[9px] text-gray-400 uppercase tracking-wider">Velocidade</span>
                             <span className="text-sm font-mono font-bold text-white">
                                 {(iraData?.context?.speed || 0).toFixed(0)} <span className="text-[9px] text-gray-500">km/h</span>
                             </span>
                         </div>
                         <div className="bg-gray-800/50 p-2 rounded border border-gray-600/50 flex flex-col items-center">
                             <span className="text-[9px] text-gray-400 uppercase tracking-wider">Cenário</span>
                             <span className="text-sm font-mono font-bold text-blue-400 uppercase">
                                 {iraData?.scenario === 'vehicle' ? 'Veículo' : iraData?.scenario === 'indoor' ? 'Interno' : 'Urbano'}
                             </span>
                         </div>
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
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" role="dialog" aria-labelledby="modal-title" aria-describedby="modal-description">
              <div className="bg-white w-full max-w-md rounded-lg overflow-hidden shadow-2xl">
                  <div className="bg-red-600 text-white p-4 flex justify-between items-center">
                      <h3 id="modal-title" className="font-bold flex items-center gap-2">
                          <ShieldAlert size={20} /> Encerrar Monitoramento
                      </h3>
                      <button onClick={() => setShowTerminationModal(false)} className="text-white/80 hover:text-white">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <form onSubmit={handleSubmitTermination} className="p-6 space-y-6">
                      <div id="modal-description" className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
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

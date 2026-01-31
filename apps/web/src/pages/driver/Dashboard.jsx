import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, AlertTriangle, MapPin, Camera, ShieldAlert, X, Upload, Clock, Copy, Check, CheckCircle, Home } from 'lucide-react';
import TokenTimer from '../../components/common/TokenTimer';
import { supabase } from '../../lib/supabase';
import TrackingMap from '../../components/map/TrackingMap';

export default function DriverDashboard() {
  console.log("SUSE-DF DriverDashboard v3.7 - Implementação de Encerramento Automático");
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  // Estados principais
  const [emergencyPhrase, setEmergencyPhrase] = useState('');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState(null);
  const [trackingId, setTrackingId] = useState(null);
  
  // Estados para Encerramento Verificado (Seção 3.7)
  const [showTerminationModal, setShowTerminationModal] = useState(false);
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
        
        // 1. Recuperar Alerta Ativo
        const { data: activeAlert } = await supabase
            .from('emergency_alerts')
            .select('id, status, termination_token_expires_at')
            .eq('user_id', user.id)
            .in('status', ['active', 'investigating', 'waiting_police_validation'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (activeAlert) {
            setActiveAlertId(activeAlert.id);
            setIsEmergencyActive(true);
            
            if (activeAlert.status === 'waiting_police_validation') {
                 setTerminationStatus('pending_validation');
                 if (activeAlert.termination_token_expires_at) {
                    setTokenExpiresAt(activeAlert.termination_token_expires_at);
                    if (new Date(activeAlert.termination_token_expires_at) < new Date()) {
                        setIsTokenExpired(true);
                    }
                 }
            }

            // Iniciar tracking
            const interval = setInterval(() => sendLocationUpdate(activeAlert.id), 5000);
            setTrackingId(interval);
        }

        // 2. Recuperar Frase de Emergência
        const { data: userData } = await supabase
            .from('users')
            .select('secret_word')
            .eq('id', user.id)
            .single();
        
        setEmergencyPhrase(userData?.secret_word || 'socorro');
    };

    fetchData();

    // 3. Sincronização em Tempo Real (Requisito 3.7)
    // Quando o admin valida o token, o status muda para 'resolved'
    const subscription = supabase
      .channel(`driver_status_sync_${user.id}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'emergency_alerts',
          filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log("Mudança de status detectada via Realtime:", payload.new.status);
        
        if (payload.new.status === 'resolved') {
            // Requisito 3.7: Atualizar status para "Validação concluída com sucesso"
            // E encerrar automaticamente a tela de exibição do token
            setTerminationStatus('resolved_success');
            
            // Parar rastreamento
            setTrackingId(prevId => {
                if (prevId) {
                    clearInterval(prevId);
                }
                return null;
            });
        } else if (payload.new.status === 'active' && terminationStatus === 'pending_validation') {
            // Se o admin rejeitar, volta para o estado normal
            setTerminationStatus('idle');
        }
      })
      .subscribe();
    
    // Localização inicial
    navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }, null, { enableHighAccuracy: true });

    return () => {
        subscription.unsubscribe();
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
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch (e) {}

      const { data, error } = await supabase
        .from('emergency_alerts')
        .insert([{
            user_id: user.id,
            status: 'active',
            trigger_type: trigger,
            initial_lat: latitude,
            initial_lng: longitude
        }])
        .select().single();

      if (error) throw error;
      setActiveAlertId(data.id);
      setIsEmergencyActive(true);
    } catch (error) {
      console.error("Erro ao acionar SOS:", error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/driver/login');
  };

  return (
    <div className={`min-h-screen ${isEmergencyActive ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="text-red-600" />
                Botão de Pânico <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">v3.7</span>
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
                                {terminationStatus === 'resolved_success' ? 'Validação concluída com sucesso' : 'Aguardando Validação'}
                            </p>
                            
                            {terminationStatus === 'resolved_success' ? (
                                /* Requisito 3.7: No local anteriormente ocupado pelo token, passa a ser exibido o botão: “Retornar ao menu principal” */
                                <div className="my-6">
                                    <button 
                                        onClick={() => {
                                            setIsEmergencyActive(false);
                                            setTerminationStatus('idle');
                                            setActiveAlertId(null);
                                        }}
                                        className="w-full py-5 px-6 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3"
                                    >
                                        <Home size={24} /> Retornar ao menu principal
                                    </button>
                                </div>
                            ) : securityToken ? (
                                /* Tela de exibição do token */
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
                       className="mt-8 px-4 py-2 bg-gray-200 text-gray-500 rounded text-xs opacity-20 hover:opacity-100 transition-opacity"
                    >
                       Encerrar Monitoramento
                    </button>
                )}
             </div>
          ) : (
             <div className="flex flex-col items-center justify-center space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900">Painel do Condutor</h2>
                  <p className="mt-1 text-gray-500">Em caso de emergência, pressione o botão abaixo.</p>
                </div>

                <button
                  onClick={() => handleSOS('button')}
                  className="w-64 h-64 bg-red-600 rounded-full flex flex-col items-center justify-center shadow-lg border-8 border-red-500 hover:bg-red-700 active:bg-red-800 transition-colors"
                >
                  <AlertTriangle className="h-24 w-24 text-white mb-2" />
                  <span className="text-4xl font-bold text-white">SOS</span>
                </button>

                <div className="bg-white p-6 rounded-lg shadow w-full max-w-md">
                  <div className="flex items-center space-x-4 mb-4">
                    <MapPin className="h-6 w-6 text-blue-500" />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Localização Atual</h3>
                      <p className="text-sm text-gray-500">Latitude: {currentLocation.lat.toFixed(6)}</p>
                      <p className="text-sm text-gray-500">Longitude: {currentLocation.lng.toFixed(6)}</p>
                    </div>
                  </div>
                </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
}

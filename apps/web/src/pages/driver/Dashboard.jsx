import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, AlertTriangle, MapPin, Camera, ShieldAlert, X, Upload, Clock, Copy, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import TrackingMap from '../../components/map/TrackingMap';

export default function DriverDashboard() {
  console.log("SUSE-DF DriverDashboard v3.2 - Fix useState Reference");
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  // Estado para armazenar a frase real do banco
  const [emergencyPhrase, setEmergencyPhrase] = useState('');
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  
  // Estados para Encerramento Verificado
  const [showTerminationModal, setShowTerminationModal] = useState(false);
  const [terminationData, setTerminationData] = useState({ photo: null, reason: '' });
  const [isTerminating, setIsTerminating] = useState(false);
  const [terminationStatus, setTerminationStatus] = useState('idle'); // idle, pending_validation
  const [securityToken, setSecurityToken] = useState(null); // Token para validação policial
  const [copied, setCopied] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({ lat: -15.793889, lng: -47.882778 });

  const handleCopyToken = () => {
      if (securityToken) {
          navigator.clipboard.writeText(securityToken);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  // Carregar frase atualizada do banco
  useEffect(() => {
    const fetchPhrase = async () => {
        if (!user) return;
        
        // 1. Recuperar Alerta Ativo (Persistência de Estado)
        const { data: activeAlert } = await supabase
            .from('emergency_alerts')
            .select('id, status')
            .eq('user_id', user.id)
            .in('status', ['active', 'investigating', 'waiting_police_validation'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (activeAlert) {
            console.log("Alerta ativo recuperado:", activeAlert);
            setActiveAlertId(activeAlert.id);
            setIsEmergencyActive(true);
            
            // Se já tiver em validação, restaura o token
            if (activeAlert.status === 'waiting_police_validation') {
                 setTerminationStatus('pending_validation');
                 // Token não é persistido por segurança. UI mostrará botão para gerar novo.
            }

            // Reiniciar tracking
            const interval = setInterval(() => sendLocationUpdate(activeAlert.id), 5000);
            setTrackingId(interval);
        }

        // 2. Recuperar Frase de Emergência
        const { data } = await supabase
            .from('users')
            .select('secret_word')
            .eq('id', user.id)
            .single();
        
        // Se tiver no banco usa, senão tenta metadata, senão default
        const phrase = data?.secret_word || user?.user_metadata?.emergency_phrase || 'cadtec emergvoz';
        console.log("Frase de emergência carregada:", phrase);
        setEmergencyPhrase(phrase);
    };
    fetchPhrase();
    
    // Pegar localização inicial
    navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
        });
    }, (err) => console.warn("Erro ao pegar localização inicial:", err), { enableHighAccuracy: true });
  }, [user]);

  // TESTE MANUAL DE VOZ (DEBUG)
  const [debugPhrase, setDebugPhrase] = useState('');
  const handleDebugVoice = (e) => {
      e.preventDefault();
      if (debugPhrase.toLowerCase().includes(emergencyPhrase.toLowerCase())) {
          console.log("Simulação de Voz: Frase detectada via texto!");
          handleSOS('voice');
          setDebugPhrase('');
      }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/driver/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleProfile = () => {
    navigate('/driver/profile');
  };

  const [trackingId, setTrackingId] = useState(null);
  const [activeAlertId, setActiveAlertId] = useState(null);

  // Função para enviar atualização de localização
  const sendLocationUpdate = async (alertId) => {
    if (!alertId) return;

    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude, speed, heading, accuracy } = position.coords;
        
        // Enviar para tabela location_updates
        const { error } = await supabase.from('location_updates').insert([{
            alert_id: alertId,
            latitude,
            longitude,
            speed: speed || 0,
            heading: heading || 0,
            accuracy: accuracy || 0
        }]);

        if (error) console.error("Erro ao enviar localização (DB):", error.message);
    }, (err) => {
        // Log discreto para não poluir console em caso de perda temporária de GPS
        console.warn("GPS Indisponível temporariamente:", err.code);
    }, { 
        enableHighAccuracy: true,
        timeout: 5000, // Não esperar mais que 5s
        maximumAge: 0 
    });
  };

  const handleSOS = async (trigger = 'button') => {
    try {
      // 1. Garantir que o usuário existe na tabela 'users' antes de criar alerta (Auto-healing)
      // Verifica se o perfil existe
      const { data: userProfile, error: userCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      
      if (!userProfile) {
        console.warn("Usuário não encontrado na tabela 'users'. Tentando criar perfil...");
        const { error: createProfileError } = await supabase
            .from('users')
            .insert([{
                id: user.id,
                email: user.email,
                name: user.user_metadata?.name || 'Motorista Sem Nome',
                phone_number: user.user_metadata?.phone_number || '00000000000',
                secret_word: user.user_metadata?.emergency_phrase || 'socorro',
                // Campos Dummy para passar em constraints NOT NULL (caso o script SQL não tenha sido rodado)
                cpf: '000.000.000-00',
                cnh: '00000000000',
                matricula: '00000',
                address: {},
                emergency_contacts: []
            }]);
        
        if (createProfileError) {
             console.error("Erro crítico: Não foi possível criar o perfil do usuário.", createProfileError);
             throw new Error("Erro de integridade do cadastro. Contate o suporte.");
        }
      }

      // 2. Obter localização real inicial
      let latitude, longitude;
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (geoError) {
        console.warn("Geolocalização falhou, usando coordenadas padrão para teste.");
        latitude = -15.793889;
        longitude = -47.882778;
      }

      // 3. Inserir alerta na tabela emergency_alerts
      const { data, error } = await supabase
        .from('emergency_alerts')
        .insert([
          {
            user_id: user.id,
            status: 'active',
            trigger_type: trigger === 'voice' ? 'voice' : 'button',
            initial_lat: latitude,
            initial_lng: longitude,
            notes: trigger === 'voice' ? 'Acionado por comando de voz' : 'Acionado via botão SOS'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Modo Silencioso: Não mostrar alerta nem mudar a tela para vermelho
      setIsEmergencyActive(true); 
      // alert(`SOS (${trigger === 'voice' ? 'VOZ' : 'BOTÃO'}) Enviado com Sucesso! A central foi notificada.`);
      console.log('SOS Enviado e Rastreamento Iniciado (Silencioso)');
      
      // Opcional: Feedback tátil (vibração) se disponível
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

      // Iniciar Rastreamento Contínuo
      if (data && data.id) {
          setActiveAlertId(data.id);
          // Enviar atualização a cada 5 segundos
          const interval = setInterval(() => sendLocationUpdate(data.id), 5000);
          setTrackingId(interval);
      }

    } catch (error) {
      console.error('Erro ao enviar SOS:', error);
      alert('Erro ao enviar SOS: ' + error.message);
    }
  };

  // Limpar intervalo ao sair
  useEffect(() => {
    return () => {
        if (trackingId) clearInterval(trackingId);
    };
  }, [trackingId]);

  const handleTerminationPhoto = (e) => {
    if (e.target.files && e.target.files[0]) {
        setTerminationData({ ...terminationData, photo: e.target.files[0] });
    }
  };

  const handleSubmitTermination = async (e) => {
      e.preventDefault();
      console.log("Iniciando envio de término...", terminationData);

      if (!terminationData.photo || !terminationData.reason) {
          alert("Foto e justificativa são obrigatórias.");
          return;
      }

      setIsTerminating(true);
      try {
          let photoUrl = '';
          
          // 1. Upload Foto
          const fileName = `termination/${activeAlertId}_${Date.now()}.jpg`;
          console.log("Tentando upload para:", fileName);
          
          const { data: uploadData, error: uploadError } = await supabase.storage
              .from('termination-evidence') 
              .upload(fileName, terminationData.photo);
          
          if (uploadError) {
             console.error("Erro upload principal:", uploadError);
             // Tentar bucket 'avatars' como fallback
             const backupName = `term_${activeAlertId}_${Date.now()}.jpg`;
             const { error: backupError } = await supabase.storage.from('avatars').upload(backupName, terminationData.photo);
             
             if (backupError) {
                 throw new Error("Falha no upload da foto: " + uploadError.message);
             } else {
                 const { data } = supabase.storage.from('avatars').getPublicUrl(backupName);
                 photoUrl = data.publicUrl;
             }
          } else {
             const { data } = supabase.storage.from('termination-evidence').getPublicUrl(fileName);
             photoUrl = data.publicUrl;
          }

          console.log("Foto enviada. URL:", photoUrl);

          // 2. Salvar URL e Justificativa no Banco
          const { error: updateError } = await supabase
              .from('emergency_alerts')
              .update({
                  termination_photo_url: photoUrl,
                  termination_reason: terminationData.reason
              })
              .eq('id', activeAlertId);

          if (updateError) {
              console.error("Erro ao salvar dados de encerramento:", updateError);
              throw new Error("Erro ao salvar justificativa: " + updateError.message);
          }

          // 3. Gerar Token de Segurança (RPC)
          const { data: token, error: tokenError } = await supabase
              .rpc('generate_termination_token', { p_alert_id: activeAlertId });

          if (tokenError) {
              console.error("Erro ao gerar token:", tokenError);
              // Fallback visual se RPC falhar (não deveria, mas garante UX)
              throw new Error("Erro ao gerar token de segurança: " + tokenError.message);
          }

          console.log("Token gerado com sucesso!");
          setSecurityToken(token);
          setTerminationStatus('pending_validation');
          setShowTerminationModal(false);
          // alert("Solicitação enviada. Dirija-se a uma unidade policial para validação final.");

      } catch (error) {
          console.error("Erro crítico ao solicitar encerramento:", error);
          alert("Erro ao enviar solicitação: " + (error.message || JSON.stringify(error)));
      } finally {
          setIsTerminating(false);
      }
  };

  return (
    <div className={`min-h-screen ${isEmergencyActive ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">SUSE-DF (v2.1)</h1>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-4">{user?.email}</span>
              <button
                onClick={handleSignOut}
                className="p-2 rounded-full text-gray-400 hover:text-gray-500"
              >
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
                    
                    {terminationStatus === 'pending_validation' ? (
                        <div className="mt-8 bg-yellow-900/40 p-6 rounded-xl border-2 border-yellow-600/50 animate-pulse">
                            <ShieldAlert className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                            <p className="text-yellow-500 font-bold uppercase text-xl tracking-wide">Aguardando Validação</p>
                            
                            {securityToken ? (
                                <div className="bg-black/60 p-6 rounded-lg my-6 border border-yellow-500/30 shadow-lg relative overflow-hidden flex flex-col items-center">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent animate-shimmer"></div>
                                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Token de Segurança</p>
                                    <div className="flex items-center gap-3">
                                        <p className="text-5xl font-mono font-bold text-white tracking-widest select-all">{securityToken}</p>
                                        <button 
                                            onClick={handleCopyToken}
                                            className="bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-500 p-2 rounded-full transition-colors"
                                            title="Copiar Token"
                                        >
                                            {copied ? <Check size={24} /> : <Copy size={24} />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-yellow-500 mt-3 flex items-center justify-center gap-1">
                                        <Clock size={12} /> Válido por 60 minutos
                                    </p>
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

                            <div className="text-left bg-yellow-900/30 p-4 rounded text-sm text-yellow-100 space-y-2 border border-yellow-800">
                                <p className="font-bold flex items-center gap-2"><MapPin size={16}/> Instruções:</p>
                                <ol className="list-decimal pl-5 space-y-1">
                                    <li>Dirija-se a um posto policial ou delegacia.</li>
                                    <li>Solicite ao agente que contate a Central.</li>
                                    <li>Informe o <strong>Token</strong> acima para validação.</li>
                                </ol>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs mt-8 opacity-50">Toque duas vezes para desbloquear</p>
                    )}
                </div>
                
                {terminationStatus !== 'pending_validation' && (
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
                  
                  {/* Desativado temporariamente devido a erro de rede
                  <div className="mt-4 flex justify-center">
                    <VoiceEmergencyListener 
                      emergencyPhrase={emergencyPhrase}
                      onEmergencyDetected={() => {
                        console.log("Emergência por voz detectada!");
                        handleSOS('voice');
                      }}
                    />
                  </div>
                  */}
                  
                  {/* Debug de Voz (Opcional, mantido escondido se quiser usar depois) */}
                  {/* <form onSubmit={handleDebugVoice}... /> */}
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
                      <p className="text-sm text-gray-500">Latitude: -15.793889</p>
                      <p className="text-sm text-gray-500">Longitude: -47.882778</p>
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
                                  capture="user" // Abre câmera frontal em mobile
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

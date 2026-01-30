import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import TrackingMap from '../components/map/TrackingMap'; 
import { ProgressiveTimer, StaticDuration } from '../components/common/Timers';
import ValidationModal from '../components/modals/ValidationModal';

export default function DriverDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  // Estado para armazenar a frase real do banco
  const [emergencyPhrase, setEmergencyPhrase] = React.useState('');
  const [isEmergencyActive, setIsEmergencyActive] = React.useState(false);
  
  // Estados para Compartilhamento em Lote (SIS_GEO)
  const [showShareSelectionModal, setShowShareSelectionModal] = useState(false);
  const [selectedAlertForShare, setSelectedAlertForShare] = useState(null);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [generatedLinks, setGeneratedLinks] = useState([]); // Array de { name, phone, link }
  const [agents, setAgents] = useState([]);
  const [loadingShare, setLoadingShare] = useState(false);

  // Estados para Relatório Final
  const [showReportModal, setShowReportModal] = useState(null); // Alert object
  const [reportData, setReportData] = useState({ qto: '', description: '' });
  const [reportFiles, setReportFiles] = useState([]); // Array de Files
  const [savingReport, setSavingReport] = useState(false);

  // Estado para Modal de Chefe de Viatura
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [savingAgent, setSavingAgent] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState(null); // ID se estiver editando
  const [newAgent, setNewAgent] = useState({
      name: '',
      matricula: '',
      posto_graduacao: '',
      lotacao: '',
      viatura: '',
      phone: '',
      observacoes: ''
  });

  const [showValidationModal, setShowValidationModal] = useState(null); // Alert object para validar

  const handleValidationSuccess = (alert, officerData) => {
      if (alert && officerData) {
          // Finalizar Ocorrência (Validação PM)
          // Abre modal de relatório final mas já sabendo que é validação
          setShowReportModal(alert);
          setReportData({ 
              qto: 'VALIDACAO-PM', 
              description: `Encerrado após validação policial presencial.\nOficial: ${officerData.rank} ${officerData.name} (${officerData.matricula})\nBatalhão: ${officerData.battalion}\nContato: ${officerData.phone}\nMotivo do Usuário: ${alert.termination_reason}` 
          });
      }
      fetchAlerts();
  };

  // Carregar frase atualizada do banco
  React.useEffect(() => {
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
  }, [user]);

  // Monitorar mudanças no status do alerta (Encerramento Automático)
  React.useEffect(() => {
    if (!activeAlertId) return;

    const channel = supabase
      .channel(`alert_updates_${activeAlertId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'emergency_alerts',
          filter: `id=eq.${activeAlertId}`,
        },
        (payload) => {
          console.log('Atualização de alerta recebida:', payload);
          if (payload.new.status === 'resolved') {
            setIsEmergencyActive(false);
            setTerminationStatus('resolved');
            setSecurityToken(null);
            setShowTerminationModal(false);
            setIsResolvedSuccess(true);
            
            // Parar rastreamento
            if (trackingId) {
                clearInterval(trackingId);
                setTrackingId(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeAlertId, trackingId]);

  // TESTE MANUAL DE VOZ (DEBUG)
  const [debugPhrase, setDebugPhrase] = React.useState('');
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

  const [trackingId, setTrackingId] = React.useState(null);
  const [activeAlertId, setActiveAlertId] = React.useState(null);

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
  React.useEffect(() => {
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
          setTimeLeft(45 * 60); // Resetar timer para 45 min
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
          
          {isResolvedSuccess ? (
              <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 animate-fade-in">
                  <div className="bg-green-100 p-6 rounded-full">
                      <Check className="h-24 w-24 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 text-center">Ocorrência Finalizada!</h2>
                  <p className="text-gray-500 text-center max-w-md">
                      A Central de Monitoramento confirmou o encerramento da ocorrência. Seu dispositivo voltou ao modo padrão.
                  </p>
                  <button 
                      onClick={() => {
                          setIsResolvedSuccess(false);
                          navigate('/driver/dashboard'); // Garante refresh ou navegação se necessário
                      }}
                      className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg"
                  >
                      Voltar para a tela inicial
                  </button>
              </div>
          ) : isEmergencyActive ? (
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
                                        <Clock size={12} /> Válido por {formatTime(timeLeft)}
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
      {/* Modal de Validação Policial */}
      {showValidationModal && (
          <ValidationModal 
              alert={showValidationModal}
              isOpen={!!showValidationModal}
              onClose={() => setShowValidationModal(null)}
              onSuccess={handleValidationSuccess}
          />
      )}
    </div>
  );
}

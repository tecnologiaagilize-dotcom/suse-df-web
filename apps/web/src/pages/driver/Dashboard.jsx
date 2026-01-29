import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, AlertTriangle, MapPin } from 'lucide-react';
import VoiceEmergencyListener from '../../components/voice/VoiceEmergencyListener';
import { supabase } from '../../lib/supabase';

export default function DriverDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  // Estado para armazenar a frase real do banco
  const [emergencyPhrase, setEmergencyPhrase] = React.useState('');
  const [isEmergencyActive, setIsEmergencyActive] = React.useState(false);

  // Carregar frase atualizada do banco
  React.useEffect(() => {
    const fetchPhrase = async () => {
        if (!user) return;
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
                name: user.user_metadata?.name || 'Usuário Sem Nome',
                phone_number: user.user_metadata?.phone_number || '',
                secret_word: user.user_metadata?.emergency_phrase || ''
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

      // Ativar modo de emergência visual
      setIsEmergencyActive(true);
      alert(`SOS (${trigger === 'voice' ? 'VOZ' : 'BOTÃO'}) Enviado com Sucesso! A central foi notificada.`);
      
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

  return (
    <div className={`min-h-screen ${isEmergencyActive ? 'bg-red-600' : 'bg-gray-100'}`}>
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">SUSE-DF</h1>
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
             <div className="flex flex-col items-center justify-center space-y-8 text-center text-white">
                <div className="animate-pulse">
                    <AlertTriangle className="h-48 w-48 text-white mb-4" />
                </div>
                <h2 className="text-4xl font-bold">SOS ENVIADO!</h2>
                <p className="text-xl">A Central de Monitoramento foi notificada.</p>
                <p className="text-lg">Sua localização está sendo rastreada em tempo real.</p>
                <p className="text-sm opacity-80 mt-8">Mantenha este aplicativo aberto.</p>
                
                <button 
                   onClick={() => setIsEmergencyActive(false)}
                   className="mt-8 px-6 py-3 bg-white text-red-600 rounded-full font-bold shadow-lg hover:bg-gray-100"
                >
                   Encerrar Alerta
                </button>
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
    </div>
  );
}

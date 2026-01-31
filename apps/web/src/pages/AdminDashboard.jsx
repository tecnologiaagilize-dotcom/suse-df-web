import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, MapPin, AlertTriangle, CheckCircle, UserPlus, X, Play, Clock, Timer, Phone, Mail, Car, User, Share2, Eye, Shield, Copy, ExternalLink, Map, Plus, Briefcase, FileText, Truck, Save, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TrackingMap from '../components/map/TrackingMap'; 
import { ProgressiveTimer, StaticDuration } from '../components/common/Timers';

export default function Dashboard() {
  const { user, userRole, signOut } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Múltiplas janelas ativas
  const [activeWindows, setActiveWindows] = useState([]);
  const [showDetailsModal, setShowDetailsModal] = useState(null);
  
  // Estados para Compartilhamento em Lote (SIS_GEO)
  const [showShareSelectionModal, setShowShareSelectionModal] = useState(false);
  const [selectedAlertForShare, setSelectedAlertForShare] = useState(null);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [generatedLinks, setGeneratedLinks] = useState([]); // Array de { name, phone, link }
  const [agents, setAgents] = useState([]);
  const [loadingShare, setLoadingShare] = useState(false);

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

  useEffect(() => {
    fetchAlerts();
    fetchAgents();

    const intervalId = setInterval(() => {
        fetchAlerts();
    }, 5000); 

    const subscription = supabase
      .channel('public:emergency_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_alerts' }, (payload) => {
        fetchAlerts();
      })
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  // Monitoramento de localizações para TODAS as janelas ativas
  useEffect(() => {
    if (activeWindows.length === 0) return;

    const subs = activeWindows.map(alert => {
        return supabase
          .channel(`location:${alert.id}`)
          .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'location_updates',
            filter: `alert_id=eq.${alert.id}`
          }, (payload) => {
            // Atualizar estado da janela específica
            setActiveWindows(prev => prev.map(w => 
                w.id === alert.id 
                ? { ...w, current_lat: payload.new.latitude, current_lng: payload.new.longitude, last_update: payload.new.recorded_at }
                : w
            ));
          })
          .subscribe();
    });

    return () => {
        subs.forEach(sub => sub.unsubscribe());
    };
  }, [activeWindows.length]); // Recriar subs apenas quando adicionar/remover janelas

  const handleAccept = async (alert) => {
      // Verificar se já está aberto
      if (activeWindows.find(w => w.id === alert.id)) return;

      const now = new Date().toISOString();

      // Adicionar à lista de janelas ativas
      const newWindow = {
          ...alert,
          current_lat: alert.initial_lat,
          current_lng: alert.initial_lng,
          accepted_at: alert.accepted_at || now // Usa o existente ou define agora localmente
      };
      setActiveWindows(prev => [...prev, newWindow]);

      // Atualizar status no banco para 'investigating' e gravar hora do aceite
      if (alert.status === 'active') {
          await supabase
            .from('emergency_alerts')
            .update({ 
                status: 'investigating',
                accepted_at: now
            })
            .eq('id', alert.id);
          
          fetchAlerts(); // Refresh visual
      }
  };

  const handleResolveAlert = async (alert) => {
      const confirmMessage = alert.status === 'waiting_police_validation' 
          ? "O usuário solicitou o encerramento. Confirma a finalização deste atendimento?"
          : "Tem certeza que deseja finalizar este atendimento?";
          
      if (!window.confirm(confirmMessage)) return;

      try {
          const now = new Date().toISOString();
          const { error } = await supabase
              .from('emergency_alerts')
              .update({ 
                  status: 'resolved',
                  resolved_at: now
              })
              .eq('id', alert.id);

          if (error) throw error;

          // Fechar janela localmente
          closeWindow(alert.id);
          fetchAlerts(); // Atualizar lista geral
          
      } catch (error) {
          console.error('Erro ao finalizar:', error);
          alert('Erro ao finalizar atendimento: ' + error.message);
      }
  };

  const closeWindow = (alertId) => {
      setActiveWindows(prev => prev.filter(w => w.id !== alertId));
  };

  const fetchAgents = async () => {
      try {
          const { data, error } = await supabase
              .from('authorized_agents')
              .select('*, share_tokens(count)')
              .order('name', { ascending: true });
          
          if (error) throw error;
          setAgents(data || []);
      } catch (error) {
          console.error('Erro ao buscar agentes:', error);
      }
  };

  const handleEditAgent = (agent) => {
      setNewAgent({
          name: agent.name,
          matricula: agent.matricula || '',
          posto_graduacao: agent.posto_graduacao || '',
          lotacao: agent.lotacao || '',
          viatura: agent.viatura || '',
          phone: agent.phone,
          observacoes: agent.observacoes || ''
      });
      setEditingAgentId(agent.id);
      setShowAgentModal(true);
      setShowShareSelectionModal(false); // Fechar modal de seleção se estiver aberto
  };

  const handleDeleteAgent = async (agent) => {
      if (!window.confirm(`Tem certeza que deseja excluir ${agent.name}?`)) return;

      try {
          const { error } = await supabase
              .from('authorized_agents')
              .delete()
              .eq('id', agent.id);

          if (error) throw error;
          
          alert('Agente excluído com sucesso!');
          fetchAgents();
      } catch (error) {
          alert('Erro ao excluir agente: ' + error.message);
      }
  };

  const handleOpenShareModal = (alert) => {
      setSelectedAlertForShare(alert);
      setSelectedAgents([]);
      setGeneratedLinks([]);
      setShowShareSelectionModal(true);
      fetchAgents(); // Recarregar para garantir dados frescos
  };

  const handleToggleAgent = (agentId) => {
      setSelectedAgents(prev => {
          if (prev.includes(agentId)) {
              return prev.filter(id => id !== agentId);
          } else {
              return [...prev, agentId];
          }
      });
  };

  const handleGenerateLinks = async () => {
      if (selectedAgents.length === 0) return;
      setLoadingShare(true);
      setGeneratedLinks([]);

      const links = [];

      try {
          for (const agentId of selectedAgents) {
              const agent = agents.find(a => a.id === agentId);
              if (!agent) continue;

              const { data: token, error } = await supabase
                  .rpc('generate_share_link', { 
                      p_alert_id: selectedAlertForShare.id,
                      p_agent_phone: agent.phone,
                      p_agent_name: agent.name
                  });

              if (error) {
                  console.error(`Erro ao gerar para ${agent.name}:`, error);
                  continue;
              }

              const baseUrl = window.location.origin;
              links.push({
                  agent_id: agent.id,
                  name: agent.name,
                  phone: agent.phone,
                  link: `${baseUrl}/tracking/${token}`
              });
          }
          setGeneratedLinks(links);
      } catch (err) {
          alert('Erro ao gerar links: ' + err.message);
      } finally {
          setLoadingShare(false);
      }
  };

  const sendToWhatsApp = (phone, link) => {
      const text = `Acompanhe a localização em tempo real da viatura/ocorrência: ${link}`;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const fetchAlerts = async () => {
    try {
      console.log("Buscando alertas...");
      const { data, error } = await supabase
        .from('emergency_alerts')
        .select(`
            *, 
            users (
                name, 
                phone_number, 
                email, 
                photo_url, 
                matricula,
                cpf,
                cnh,
                address,
                emergency_contacts,
                car_brand,
                car_model,
                car_plate,
                car_color
            )
        `)
        .order('created_at', { ascending: false });

      if (error) {
          console.error("Erro Supabase:", error);
          throw error;
      }
      console.log("Alertas encontrados:", data?.length, data);
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-red-100 text-red-800';
      case 'investigating': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="text-red-600" />
            Central de Monitoramento <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">v2.3</span>
          </h1>
          <div className="flex items-center gap-4">
            {(userRole === 'admin' || userRole === 'master' || userRole === 'supervisor') && (
              <button onClick={() => navigate('/admin/users')} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100">
                <UserPlus size={18} /> Gestão
              </button>
            )}
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button onClick={() => signOut()} className="p-2 text-gray-500 hover:text-red-600 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Área de Trabalho (Grid de Mapas) */}
      {activeWindows.length > 0 && (
          <div className="bg-gray-200 p-4 border-b border-gray-300 shadow-inner overflow-x-auto whitespace-nowrap min-h-[450px]">
              <h2 className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">
                  Atendimentos em Andamento ({activeWindows.length})
              </h2>
              <div className="flex gap-4">
                  {activeWindows.map(activeWindow => (
                      <div key={activeWindow.id} className="inline-block w-[800px] h-[400px] bg-white rounded-lg shadow-xl overflow-hidden border border-gray-300 flex flex-col relative shrink-0">
                          
                          {/* Top Bar: Status e Tempos */}
                          <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center h-12">
                              <div className="flex items-center gap-4">
                                  <span className="font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                                    <AlertTriangle size={16} /> Emergência
                                  </span>
                                  
                                  {/* Contador de Espera (Fixo: Accepted - Created) */}
                                  <StaticDuration 
                                    start={activeWindow.created_at} 
                                    end={activeWindow.accepted_at || new Date().toISOString()} 
                                    label="Espera"
                                    icon={Timer}
                                    colorClass="text-yellow-400"
                                  />

                                  {/* Contador de Duração (Progressivo: Now - Created) */}
                                  <ProgressiveTimer 
                                    startTime={activeWindow.created_at} 
                                    label="Duração"
                                    icon={Clock}
                                    colorClass="text-green-400"
                                  />

                                  <button 
                                      onClick={() => handleOpenShareModal(activeWindow)}
                                      className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded transition-colors ml-2"
                                      title="Compartilhar Localização"
                                  >
                                      <Share2 size={14} /> Compartilhar
                                  </button>

                                  <button 
                                      onClick={() => handleResolveAlert(activeWindow)}
                                      className={`flex items-center gap-1 text-white text-xs px-2 py-1 rounded transition-colors ml-2 font-bold shadow-sm ${
                                        activeWindow.status === 'waiting_police_validation' 
                                            ? 'bg-yellow-500 hover:bg-yellow-600 animate-pulse text-black border border-yellow-600' 
                                            : 'bg-green-600 hover:bg-green-700'
                                      }`}
                                      title={activeWindow.status === 'waiting_police_validation' ? "Usuário solicitou encerramento" : "Finalizar Atendimento"}
                                  >
                                      <CheckCircle size={14} /> 
                                      {activeWindow.status === 'waiting_police_validation' ? 'ENCERRAR?' : 'Finalizar'}
                                  </button>
                              </div>
                              <button onClick={() => closeWindow(activeWindow.id)} className="text-gray-400 hover:text-white">
                                  <X size={20} />
                              </button>
                          </div>

                          <div className="flex flex-1 h-full overflow-hidden">
                              {/* Coluna da Esquerda: Dados do Solicitante */}
                              <div className="w-1/3 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-4 overflow-y-auto whitespace-normal">
                                  <div className="flex flex-col items-center text-center pb-4 border-b border-gray-200">
                                      {activeWindow.users?.photo_url ? (
                                          <img 
                                            src={activeWindow.users.photo_url} 
                                            alt="Foto" 
                                            className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md mb-2"
                                          />
                                      ) : (
                                          <div className="w-24 h-24 rounded-full bg-gray-300 flex items-center justify-center mb-2 border-4 border-white shadow-md">
                                              <User size={40} className="text-gray-500" />
                                          </div>
                                      )}
                                      <h3 className="font-bold text-lg text-gray-900 leading-tight">{activeWindow.users?.name || 'Desconhecido'}</h3>
                                      <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full mt-1">
                                        Matrícula: {activeWindow.users?.matricula || '---'}
                                      </span>
                                  </div>

                                  <div className="space-y-3 text-sm">
                                      <div className="flex items-start gap-2">
                                          <Phone size={16} className="text-gray-400 mt-0.5" />
                                          <div>
                                              <span className="block text-xs text-gray-500">Telefone</span>
                                              <span className="font-medium text-gray-900">{activeWindow.users?.phone_number || 'Não informado'}</span>
                                          </div>
                                      </div>

                                      <div className="flex items-start gap-2 pt-2 border-t border-gray-200">
                                          <Car size={16} className="text-gray-400 mt-0.5" />
                                          <div className="w-full">
                                              <span className="block text-xs text-gray-500 font-bold mb-1">Dados do Veículo</span>
                                              <div className="grid grid-cols-1 gap-1 text-sm">
                                                  <div>
                                                      <span className="text-gray-500 text-xs">Marca/Modelo:</span>
                                                      <span className="block font-medium text-gray-900">{activeWindow.users?.car_brand || '-'} {activeWindow.users?.car_model}</span>
                                                  </div>
                                                  <div className="flex justify-between">
                                                      <div>
                                                          <span className="text-gray-500 text-xs">Placa:</span>
                                                          <span className="block font-medium text-gray-900">{activeWindow.users?.car_plate || '-'}</span>
                                                      </div>
                                                      <div>
                                                          <span className="text-gray-500 text-xs">Cor:</span>
                                                          <span className="block font-medium text-gray-900">{activeWindow.users?.car_color || '-'}</span>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>

                              {/* Coluna da Direita: Mapa */}
                              <div className="w-2/3 h-full relative bg-gray-200">
                                   <TrackingMap 
                                        lat={activeWindow.current_lat}
                                        lng={activeWindow.current_lng}
                                    />
                                    
                                    {/* Footer do Mapa */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-2 px-4 border-t border-gray-200 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                                <span className="font-mono text-gray-600">
                                                    {activeWindow.current_lat?.toFixed(5)}, {activeWindow.current_lng?.toFixed(5)}
                                                </span>
                                            </div>
                                            
                                            {/* Botão Ver Detalhes (Olho) */}
                                            <button 
                                                onClick={() => setShowDetailsModal(activeWindow)}
                                                className="group flex items-center gap-1 text-gray-500 hover:text-blue-600 transition-colors relative ml-4"
                                                title="Ver Detalhes"
                                            >
                                                <Eye size={18} />
                                                <span className="text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute left-6 whitespace-nowrap bg-gray-800 text-white px-2 py-1 rounded">
                                                    Ver Detalhes
                                                </span>
                                            </button>
                                        </div>

                                        <span className="text-xs text-gray-500">
                                            Atualizado: {activeWindow.last_update ? new Date(activeWindow.last_update).toLocaleTimeString() : '...'}
                                        </span>
                                    </div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Modal de Detalhes do Motorista */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col rounded-lg shadow-2xl overflow-hidden animate-fade-in">
                <div className="bg-gray-800 text-white p-4 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <User size={20} /> Detalhes Completos do Motorista
                    </h3>
                    <button onClick={() => setShowDetailsModal(null)} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-gray-200">
                        {showDetailsModal.users?.photo_url ? (
                            <img src={showDetailsModal.users.photo_url} className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 shrink-0" />
                        ) : (
                            <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                                <User size={64} className="text-gray-400" />
                            </div>
                        )}
                        <div className="text-center sm:text-left flex-1">
                            <h2 className="text-2xl font-bold text-gray-900">{showDetailsModal.users?.name}</h2>
                            <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                                <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                                    Matrícula: {showDetailsModal.users?.matricula || '---'}
                                </span>
                                <span className="text-sm bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-medium">
                                    CPF: {showDetailsModal.users?.cpf || '---'}
                                </span>
                                <span className="text-sm bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-medium">
                                    CNH: {showDetailsModal.users?.cnh || '---'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Coluna Esquerda: Contato e Endereço */}
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Phone size={16} /> Contato Pessoal
                                </h4>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                                    <div>
                                        <span className="text-xs text-gray-500 block">Telefone</span>
                                        <span className="font-medium text-gray-900">{showDetailsModal.users?.phone_number}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-gray-500 block">Email</span>
                                        <span className="font-medium text-gray-900 break-all">{showDetailsModal.users?.email}</span>
                                    </div>
                                </div>
                            </div>

                            {showDetailsModal.users?.address && (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <MapPin size={16} /> Endereço Residencial
                                    </h4>
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
                                        <p className="font-bold text-gray-900">
                                            {showDetailsModal.users.address.street}, {showDetailsModal.users.address.number}
                                        </p>
                                        <p className="text-gray-700">
                                            {showDetailsModal.users.address.complement && `${showDetailsModal.users.address.complement} - `}
                                            {showDetailsModal.users.address.neighborhood}
                                        </p>
                                        <p className="text-gray-700">
                                            {showDetailsModal.users.address.city} / {showDetailsModal.users.address.state}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">CEP: {showDetailsModal.users.address.cep}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Coluna Direita: Veículo e Emergência */}
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <Car size={16} /> Veículo Cadastrado
                                </h4>
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-xs text-blue-600 block font-bold">Marca/Modelo</span>
                                            <span className="text-sm font-medium text-gray-900">{showDetailsModal.users?.car_brand} {showDetailsModal.users?.car_model}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-blue-600 block font-bold">Placa</span>
                                            <span className="text-sm font-medium text-gray-900">{showDetailsModal.users?.car_plate}</span>
                                        </div>
                                        <div>
                                            <span className="text-xs text-blue-600 block font-bold">Cor</span>
                                            <span className="text-sm font-medium text-gray-900">{showDetailsModal.users?.car_color}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {showDetailsModal.users?.emergency_contacts && showDetailsModal.users.emergency_contacts.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <AlertTriangle size={16} /> Contatos de Emergência
                                    </h4>
                                    <div className="space-y-3">
                                        {showDetailsModal.users.emergency_contacts.map((contact, idx) => (
                                            <div key={idx} className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-gray-900">{contact.name}</span>
                                                    <span className="text-xs font-bold text-red-600 bg-white px-2 py-0.5 rounded-full border border-red-100">
                                                        {contact.relationship}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-gray-700 mb-1">
                                                    <Phone size={12} /> {contact.phone}
                                                </div>
                                                {contact.address && (
                                                    <div className="flex items-start gap-2 text-gray-600 text-xs border-t border-red-100 pt-1 mt-1">
                                                        <MapPin size={12} className="shrink-0 mt-0.5" /> {contact.address}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="bg-gray-50 p-4 flex justify-end shrink-0 border-t border-gray-200">
                    <button onClick={() => setShowDetailsModal(null)} className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Modal de Compartilhamento em Lote */}
      {showShareSelectionModal && (
          <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-fade-in border border-gray-200 flex flex-col max-h-[90vh]">
                  <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-4 flex justify-between items-center shrink-0">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <Share2 size={20} /> Compartilhar com Chefes de Viatura
                      </h3>
                      <button onClick={() => setShowShareSelectionModal(false)} className="text-blue-200 hover:text-white transition-colors">
                          <X size={24} />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-hidden flex flex-col p-6">
                      {generatedLinks.length > 0 ? (
                          <div className="space-y-4 overflow-y-auto flex-1">
                              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                                  <CheckCircle className="text-green-600" size={24} />
                                  <div>
                                      <h4 className="font-bold text-green-900">Links Gerados com Sucesso!</h4>
                                      <p className="text-green-700 text-sm">Envie os links individualmente abaixo.</p>
                                  </div>
                              </div>
                              
                              <div className="grid gap-3">
                                  {generatedLinks.map((item, idx) => (
                                      <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
                                          <div>
                                              <p className="font-bold text-gray-900">{item.name}</p>
                                              <p className="text-xs text-gray-500">{item.phone}</p>
                                          </div>
                                          <button 
                                              onClick={() => sendToWhatsApp(item.phone, item.link)}
                                              className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-lg hover:bg-[#128C7E] font-medium transition-colors shadow-sm"
                                          >
                                              <Share2 size={16} /> Enviar WhatsApp
                                          </button>
                                      </div>
                                  ))}
                              </div>

                              <button 
                                  onClick={() => {
                                      setGeneratedLinks([]);
                                      setShowShareSelectionModal(false);
                                  }}
                                  className="w-full mt-4 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                              >
                                  Fechar
                              </button>
                          </div>
                      ) : (
                          <div className="flex flex-col h-full">
                              <div className="flex justify-between items-center mb-4">
                                  <p className="text-gray-600">Selecione os chefes de viatura que receberão o link:</p>
                                  <button 
                                      onClick={() => {
                                          setShowShareSelectionModal(false);
                                          setNewAgent({ name: '', matricula: '', posto_graduacao: '', lotacao: '', viatura: '', phone: '', observacoes: '' });
                                          setEditingAgentId(null);
                                          setShowAgentModal(true);
                                      }}
                                      className="flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-md hover:bg-blue-200 text-sm font-medium transition-colors"
                                  >
                                      <Plus size={16} /> Novo Chefe
                                  </button>
                              </div>
                              
                              <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg bg-gray-50 p-2 space-y-2">
                                  {agents.length === 0 ? (
                                      <p className="text-center text-gray-500 py-8">Nenhum chefe de viatura cadastrado.</p>
                                  ) : (
                                      agents.map(agent => {
                                          const hasLinks = agent.share_tokens && agent.share_tokens[0]?.count > 0;
                                          return (
                                              <div key={agent.id} className="flex items-center gap-2 p-3 bg-white rounded-md border border-gray-200 hover:border-blue-400 transition-colors group">
                                                  <label className="flex items-center gap-3 flex-1 cursor-pointer">
                                                      <input 
                                                          type="checkbox"
                                                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                                          checked={selectedAgents.includes(agent.id)}
                                                          onChange={() => handleToggleAgent(agent.id)}
                                                      />
                                                      <div className="flex-1">
                                                          <div className="flex justify-between">
                                                              <span className="font-bold text-gray-900">{agent.name}</span>
                                                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{agent.posto_graduacao || 'Agente'}</span>
                                                          </div>
                                                          <div className="flex justify-between mt-1">
                                                              <span className="text-xs text-gray-500">{agent.lotacao} - {agent.viatura}</span>
                                                              <span className="text-xs text-gray-400">{agent.phone}</span>
                                                          </div>
                                                      </div>
                                                  </label>
                                                  
                                                  <div className="flex items-center gap-1 border-l pl-2 ml-2 border-gray-200">
                                                      <button 
                                                          onClick={(e) => { e.stopPropagation(); handleEditAgent(agent); }}
                                                          disabled={hasLinks}
                                                          className={`p-1.5 rounded transition-colors ${hasLinks ? 'text-gray-300 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50 hover:text-blue-700'}`}
                                                          title={hasLinks ? "Não é possível editar: agente já recebeu links" : "Editar"}
                                                      >
                                                          <Edit size={16} />
                                                      </button>
                                                      <button 
                                                          onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent); }}
                                                          disabled={hasLinks}
                                                          className={`p-1.5 rounded transition-colors ${hasLinks ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50 hover:text-red-700'}`}
                                                          title={hasLinks ? "Não é possível excluir: agente já recebeu links" : "Excluir"}
                                                      >
                                                          <Trash2 size={16} />
                                                      </button>
                                                  </div>
                                              </div>
                                          );
                                      })
                                  )}
                              </div>
                              
                              <div className="pt-4 mt-auto border-t border-gray-200 flex justify-end gap-3">
                                  <button 
                                      onClick={() => setShowShareSelectionModal(false)}
                                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium transition-colors"
                                  >
                                      Cancelar
                                  </button>
                                  <button 
                                      onClick={handleGenerateLinks}
                                      disabled={selectedAgents.length === 0 || loadingShare}
                                      className="px-6 py-2 bg-blue-900 text-white rounded-md hover:bg-blue-800 font-medium transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                  >
                                      {loadingShare ? (
                                          <>
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                              Gerando...
                                          </>
                                      ) : (
                                          <>
                                              <Share2 size={18} />
                                              Gerar Links ({selectedAgents.length})
                                          </>
                                      )}
                                  </button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Modal de Chefe de Viatura */}
      {showAgentModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-fade-in border border-gray-200">
                <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <UserPlus size={20} /> {editingAgentId ? 'Editar Chefe de Viatura' : 'Cadastrar Chefe de Viatura'}
                    </h3>
                    <button onClick={() => { setShowAgentModal(false); setEditingAgentId(null); setNewAgent({ name: '', matricula: '', posto_graduacao: '', lotacao: '', viatura: '', phone: '', observacoes: '' }); }} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    setSavingAgent(true);
                    try {
                        let error;
                        
                        if (editingAgentId) {
                            // Atualizar (Update)
                            const { error: updateError } = await supabase.from('authorized_agents')
                                .update({
                                    name: newAgent.name,
                                    matricula: newAgent.matricula,
                                    posto_graduacao: newAgent.posto_graduacao,
                                    lotacao: newAgent.lotacao,
                                    viatura: newAgent.viatura,
                                    phone: newAgent.phone.startsWith('55') ? newAgent.phone : `55${newAgent.phone}`,
                                    observacoes: newAgent.observacoes,
                                    organization: newAgent.lotacao 
                                })
                                .eq('id', editingAgentId);
                            error = updateError;
                        } else {
                            // Inserir (Insert)
                            const { error: insertError } = await supabase.from('authorized_agents').insert([{
                                name: newAgent.name,
                                matricula: newAgent.matricula,
                                posto_graduacao: newAgent.posto_graduacao,
                                lotacao: newAgent.lotacao,
                                viatura: newAgent.viatura,
                                phone: newAgent.phone.startsWith('55') ? newAgent.phone : `55${newAgent.phone}`,
                                observacoes: newAgent.observacoes,
                                organization: newAgent.lotacao 
                            }]);
                            error = insertError;
                        }

                        if (error) throw error;
                        alert(editingAgentId ? 'Agente atualizado com sucesso!' : 'Agente salvo com sucesso!');
                        setShowAgentModal(false);
                        setEditingAgentId(null);
                        setNewAgent({ name: '', matricula: '', posto_graduacao: '', lotacao: '', viatura: '', phone: '', observacoes: '' });
                        fetchAgents(); // Atualizar lista
                    } catch (err) {
                        alert('Erro ao salvar agente: ' + err.message);
                    } finally {
                        setSavingAgent(false);
                    }
                }} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                            <input 
                                type="text" 
                                required
                                value={newAgent.name}
                                onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula</label>
                            <input 
                                type="text" 
                                required
                                value={newAgent.matricula}
                                onChange={(e) => setNewAgent({...newAgent, matricula: e.target.value})}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Posto/Graduação</label>
                            <select 
                                required
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                value={newAgent.posto_graduacao} 
                                onChange={e => setNewAgent({...newAgent, posto_graduacao: e.target.value})}
                            >
                                <option value="">Selecione...</option>
                                <option value="Soldado">Soldado</option>
                                <option value="Cabo">Cabo</option>
                                <option value="Sargento">Sargento</option>
                                <option value="Subtenente">Subtenente</option>
                                <option value="Aspirante">Aspirante</option>
                                <option value="Tenente">Tenente</option>
                                <option value="Capitão">Capitão</option>
                                <option value="Major">Major</option>
                                <option value="Tenente-Coronel">Tenente-Coronel</option>
                                <option value="Coronel">Coronel</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Batalhão (Lotação)</label>
                            <select 
                                required
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                value={newAgent.lotacao} 
                                onChange={e => setNewAgent({...newAgent, lotacao: e.target.value})}
                            >
                                <option value="">Selecione o Batalhão...</option>
                                <optgroup label="Batalhões de Policiamento de Área (BPM)">
                                    <option value="1º BPM – Asa Sul">1º BPM – Asa Sul</option>
                                    <option value="2º BPM – Taguatinga">2º BPM – Taguatinga</option>
                                    <option value="3º BPM – Ceilândia">3º BPM – Ceilândia</option>
                                    <option value="4º BPM – Guará">4º BPM – Guará</option>
                                    <option value="5º BPM – Asa Norte">5º BPM – Asa Norte</option>
                                    <option value="6º BPM – Esplanada dos Ministérios">6º BPM – Esplanada dos Ministérios</option>
                                    <option value="7º BPM – Lago Sul">7º BPM – Lago Sul</option>
                                    <option value="8º BPM – Ceilândia">8º BPM – Ceilândia</option>
                                    <option value="9º BPM – Gama">9º BPM – Gama</option>
                                    <option value="10º BPM – Ceilândia">10º BPM – Ceilândia</option>
                                    <option value="11º BPM – Samambaia">11º BPM – Samambaia</option>
                                    <option value="12º BPM – Judiciário">12º BPM – Judiciário (Tribunais)</option>
                                    <option value="13º BPM – Sobradinho">13º BPM – Sobradinho</option>
                                    <option value="14º BPM – Planaltina">14º BPM – Planaltina</option>
                                    <option value="15º BPM – Ceilândia">15º BPM – Ceilândia</option>
                                    <option value="16º BPM – Brazlândia">16º BPM – Brazlândia</option>
                                    <option value="17º BPM – Águas Claras">17º BPM – Águas Claras</option>
                                    <option value="18º BPM – Recanto das Emas">18º BPM – Recanto das Emas</option>
                                    <option value="19º BPM – Ceilândia">19º BPM – Ceilândia</option>
                                    <option value="20º BPM – Paranoá">20º BPM – Paranoá</option>
                                    <option value="21º BPM – São Sebastião">21º BPM – São Sebastião</option>
                                    <option value="22º BPM – Jardim Botânico">22º BPM – Jardim Botânico</option>
                                    <option value="23º BPM – Ceilândia">23º BPM – Ceilândia</option>
                                    <option value="24º BPM – Lago Norte">24º BPM – Lago Norte</option>
                                    <option value="25º BPM – Samambaia">25º BPM – Samambaia</option>
                                    <option value="26º BPM – Santa Maria">26º BPM – Santa Maria</option>
                                    <option value="27º BPM – Recanto das Emas">27º BPM – Recanto das Emas</option>
                                    <option value="28º BPM – Riacho Fundo">28º BPM – Riacho Fundo</option>
                                    <option value="29º BPM – SIA/SCIA">29º BPM – SIA/SCIA</option>
                                    <option value="30º BPM – Planaltina">30º BPM – Planaltina</option>
                                    <option value="31º BPM – Fercal">31º BPM – Fercal (Ambiental)</option>
                                    <option value="32º BPM – Ceilândia">32º BPM – Ceilândia</option>
                                    <option value="33º BPM – Sol Nascente/Pôr do Sol">33º BPM – Sol Nascente/Pôr do Sol</option>
                                </optgroup>
                                <optgroup label="Batalhões Especializados e Operacionais">
                                    <option value="BOPE">BOPE – Batalhão de Operações Especiais</option>
                                    <option value="BPCHOQUE">BPCHOQUE – Batalhão de Polícia de Choque</option>
                                    <option value="BPATAMO">BPATAMO – Batalhão de Polícia de Choque (Tático Motorizado)</option>
                                    <option value="BPTRAN">BPTRAN – Batalhão de Polícia de Trânsito</option>
                                    <option value="BPRV">BPRV – Batalhão de Polícia Rodoviária</option>
                                    <option value="BPMA">BPMA – Batalhão de Polícia Militar Ambiental</option>
                                    <option value="BPCÃES">BPCÃES – Batalhão de Policiamento com Cães</option>
                                    <option value="BPGEP">BPGEP – Batalhão de Polícia de Guarda e Escolta</option>
                                    <option value="BAvOp">BAvOp – Batalhão de Aviação Operacional</option>
                                    <option value="BPESC">BPESC – Batalhão de Polícia Escolar</option>
                                    <option value="BPChoque/RPon">BPChoque/RPon – Batalhão de Polícia Montada</option>
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Viatura</label>
                            <input 
                                type="text" 
                                value={newAgent.viatura}
                                onChange={(e) => setNewAgent({...newAgent, viatura: e.target.value})}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp)</label>
                            <input 
                                type="tel" 
                                required
                                placeholder="61999999999"
                                value={newAgent.phone}
                                onChange={(e) => {
                                    // Remove tudo que não for número
                                    let val = e.target.value.replace(/\D/g, '');
                                    
                                    // Limite máximo para evitar erros (DDD + 9 + 8 dígitos = 11)
                                    if (val.length > 11) val = val.slice(0, 11);
                                    
                                    // Limite máximo para evitar erros (DDD + 9 + 8 dígitos = 11)
                                    if (val.length > 11) val = val.slice(0, 11);
                                    
                                    setNewAgent({...newAgent, phone: val});
                                }}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Digite apenas números com DDD (ex: 61999999999). O código 55 será adicionado automaticamente.
                            </p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                        <textarea 
                            value={newAgent.observacoes}
                            onChange={(e) => setNewAgent({...newAgent, observacoes: e.target.value})}
                            rows={3}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                        />
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button 
                            type="button"
                            onClick={() => { setShowAgentModal(false); setEditingAgentId(null); setNewAgent({ name: '', matricula: '', posto_graduacao: '', lotacao: '', viatura: '', phone: '', observacoes: '' }); }} 
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={savingAgent}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save size={18} />
                            {savingAgent ? 'Salvando...' : (editingAgentId ? 'Atualizar Chefe de Viatura' : 'Salvar Chefe de Viatura')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Lista de Alertas */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Fila de Alertas</h2>
            <button 
                onClick={() => setShowAgentModal(true)}
                className="flex items-center gap-2 bg-blue-900 text-white px-3 py-2 rounded-md hover:bg-blue-800 shadow-sm text-sm font-medium transition-colors"
            >
                <UserPlus size={16} /> Novo Chefe de Viatura
            </button>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando alertas...</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-2">
              <CheckCircle className="text-green-500 w-12 h-12" />
              <p>Nenhum alerta ativo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motorista</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Horário</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compartilhamento</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {alerts.map((alert) => (
                    <tr key={alert.id} className={`hover:bg-gray-50 ${activeWindows.find(w => w.id === alert.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(alert.status)}`}>
                          {alert.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{alert.users?.name || 'Desconhecido'}</div>
                        <div className="text-sm text-gray-500">{alert.users?.phone_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {alert.trigger_type === 'voice' ? '🗣️ Voz' : '🔴 Botão'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {activeWindows.find(w => w.id === alert.id) ? (
                            <span className="text-blue-600 font-bold flex items-center gap-1">
                                <CheckCircle size={16} /> Em Atendimento
                            </span>
                        ) : (
                            <button 
                                onClick={() => handleAccept(alert)}
                                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 flex items-center gap-1 text-xs uppercase font-bold shadow-sm"
                            >
                              <Play size={14} /> Assumir
                            </button>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button 
                              onClick={() => handleOpenShareModal(alert)}
                              className="text-gray-600 hover:text-blue-600 flex items-center gap-1 transition-colors"
                              title="Compartilhar com Chefes de Viatura"
                          >
                              <Share2 size={18} />
                              <span className="text-xs">Enviar Link</span>
                          </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

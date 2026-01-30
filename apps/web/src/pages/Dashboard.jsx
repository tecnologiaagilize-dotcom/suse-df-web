import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  LogOut, 
  MapPin, 
  AlertTriangle, 
  Users, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  Eye,
  Menu,
  X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const STATUS_COLORS = {
  active: 'bg-red-100 text-red-800 border-red-200',
  investigating: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  resolved: 'bg-green-100 text-green-800 border-green-200',
  false_alarm: 'bg-gray-100 text-gray-800 border-gray-200',
  waiting_police_validation: 'bg-orange-100 text-orange-800 border-orange-200'
};

const STATUS_LABELS = {
  active: 'EMERGÊNCIA ATIVA',
  investigating: 'Em Investigação',
  resolved: 'Resolvido',
  false_alarm: 'Falso Alarme',
  waiting_police_validation: 'Aguardando Validação Policial'
};

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active, all, resolved
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [staffProfile, setStaffProfile] = useState(null);
  
  // Modal de Validação
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationToken, setValidationToken] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    fetchStaffProfile();
    fetchAlerts();
    
    // Realtime subscription
    const channel = supabase
      .channel('admin_alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_alerts' }, (payload) => {
        console.log('Change received!', payload);
        fetchAlerts(); // Refresh list on any change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const fetchStaffProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) setStaffProfile(data);
    } catch (e) {
      console.error("Erro ao carregar perfil staff", e);
    }
  };

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('emergency_alerts')
        .select(`
          *,
          users:user_id (name, phone_number, email, cpf, matricula, car_plate, car_model)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'active') {
        query = query.in('status', ['active', 'investigating', 'waiting_police_validation']);
      } else if (filter === 'resolved') {
        query = query.in('status', ['resolved', 'false_alarm']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAlerts(data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (alertId, newStatus) => {
    try {
      const { error } = await supabase
        .from('emergency_alerts')
        .update({ status: newStatus })
        .eq('id', alertId);

      if (error) throw error;
      
      // Se resolvido, limpa seleção
      if (newStatus === 'resolved' || newStatus === 'false_alarm') {
        setSelectedAlert(null);
      }
      
      fetchAlerts();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status');
    }
  };

  const handleValidateToken = async (e) => {
    e.preventDefault();
    if (!validationToken) return;
    
    setIsValidating(true);
    setValidationError('');

    try {
      const { data, error } = await supabase
        .rpc('validate_termination_token', { 
            p_token_input: validationToken,
            p_admin_id: user.id 
        });

      if (error) throw error;

      if (data && data.success) {
          alert("Validação Confirmada! Ocorrência encerrada com sucesso.");
          setShowValidationModal(false);
          setValidationToken('');
          fetchAlerts();
      } else {
          setValidationError(data?.message || "Token inválido ou expirado.");
      }
    } catch (err) {
        console.error("Erro validação:", err);
        setValidationError(err.message || "Erro ao validar token.");
    } finally {
        setIsValidating(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SUSE-DF <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full border">Admin v2.0</span></h1>
                <p className="text-xs text-gray-500">Sistema Unificado de Segurança Emergencial</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <div className="hidden md:block text-right">
                  <p className="text-sm font-medium text-gray-900">{staffProfile?.name || user.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{staffProfile?.role || 'Admin'}</p>
               </div>
               <button
                  onClick={() => setShowValidationModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
               >
                  <CheckCircle size={16} /> Validar Encerramento
               </button>
               <div className="h-8 w-px bg-gray-200 mx-2"></div>
               <button
                onClick={handleSignOut}
                className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Sair"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar / Lista de Alertas */}
        <aside className="w-full md:w-96 bg-white border-r border-gray-200 flex flex-col z-0">
            {/* Filtros */}
            <div className="p-4 border-b border-gray-200 space-y-4">
                <div className="flex rounded-md shadow-sm" role="group">
                    <button
                        onClick={() => setFilter('active')}
                        className={`flex-1 px-4 py-2 text-sm font-medium border rounded-l-lg ${
                            filter === 'active' 
                            ? 'bg-red-50 text-red-700 border-red-200' 
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        Ativos
                    </button>
                    <button
                        onClick={() => setFilter('all')}
                        className={`flex-1 px-4 py-2 text-sm font-medium border-t border-b border-r ${
                            filter === 'all' 
                            ? 'bg-gray-100 text-gray-900 border-gray-300' 
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        Todos
                    </button>
                </div>
                
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar motorista, placa..."
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-red-500 focus:border-red-500 sm:text-sm"
                    />
                </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                        <p>Nenhuma ocorrência encontrada.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-200">
                        {alerts.map((alert) => (
                            <li 
                                key={alert.id} 
                                onClick={() => setSelectedAlert(alert)}
                                className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedAlert?.id === alert.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                            >
                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[alert.status] || 'bg-gray-100'}`}>
                                            {STATUS_LABELS[alert.status] || alert.status}
                                        </span>
                                        <span className="text-xs text-gray-500 flex items-center gap-1">
                                            <Clock size={12} />
                                            {new Date(alert.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-bold text-gray-900 mb-1">
                                        {alert.users?.name || 'Motorista Desconhecido'}
                                    </h3>
                                    <p className="text-xs text-gray-600 mb-2 truncate">
                                        {alert.notes || 'Sem observações'}
                                    </p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <MapPin size={12} /> Taguatinga (Simulado)
                                        </span>
                                        {alert.trigger_type === 'voice' && (
                                            <span className="flex items-center gap-1 text-purple-600 font-bold">
                                                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div> Voz
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>

        {/* Área Principal (Detalhes / Mapa) */}
        <main className="flex-1 bg-gray-100 relative flex flex-col">
            {selectedAlert ? (
                <>
                    {/* Header do Detalhe */}
                    <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-10">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                Ocorrência #{selectedAlert.id.slice(0, 8)}
                                {selectedAlert.status === 'waiting_police_validation' && (
                                    <span className="animate-pulse text-xs bg-orange-500 text-white px-2 py-1 rounded font-bold uppercase">
                                        Requer Validação
                                    </span>
                                )}
                            </h2>
                            <p className="text-sm text-gray-500">
                                Iniciada em {new Date(selectedAlert.created_at).toLocaleString()}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {selectedAlert.status !== 'resolved' && (
                                <>
                                    <button 
                                        onClick={() => handleStatusChange(selectedAlert.id, 'investigating')}
                                        className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                                    >
                                        Investigar
                                    </button>
                                    <button 
                                        onClick={() => handleStatusChange(selectedAlert.id, 'false_alarm')}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                                    >
                                        Falso Alarme
                                    </button>
                                    <button 
                                        onClick={() => setShowValidationModal(true)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm"
                                    >
                                        Validar & Encerrar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Mapa */}
                    <div className="flex-1 relative z-0">
                         <MapContainer 
                            center={[selectedAlert.initial_lat || -15.793889, selectedAlert.initial_lng || -47.882778]} 
                            zoom={13} 
                            style={{ height: '100%', width: '100%' }}
                        >
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; OpenStreetMap contributors'
                            />
                            <Marker position={[selectedAlert.initial_lat || -15.793889, selectedAlert.initial_lng || -47.882778]}>
                                <Popup>
                                    <div className="font-bold text-center">
                                        Local do Acionamento<br/>
                                        {new Date(selectedAlert.created_at).toLocaleTimeString()}
                                    </div>
                                </Popup>
                            </Marker>
                        </MapContainer>
                        
                        {/* Info Overlay */}
                        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-white/95 backdrop-blur rounded-lg shadow-lg p-4 border border-gray-200 z-[400]">
                            <h3 className="font-bold text-gray-900 border-b pb-2 mb-3 flex items-center gap-2">
                                <Users size={16} /> Dados do Motorista
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Nome:</span>
                                    <span className="font-medium text-gray-900">{selectedAlert.users?.name || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Telefone:</span>
                                    <span className="font-medium text-gray-900">{selectedAlert.users?.phone_number || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Veículo:</span>
                                    <span className="font-medium text-gray-900">{selectedAlert.users?.car_model || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Placa:</span>
                                    <span className="font-medium text-gray-900">{selectedAlert.users?.car_plate || 'N/A'}</span>
                                </div>
                                <div className="mt-4 pt-2 border-t">
                                    <span className="text-gray-500 block mb-1">Evidência de Encerramento:</span>
                                    {selectedAlert.termination_photo_url ? (
                                        <a 
                                            href={selectedAlert.termination_photo_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                            <Eye size={14} /> Ver Foto de Validação
                                        </a>
                                    ) : (
                                        <span className="text-gray-400 italic">Nenhuma foto enviada</span>
                                    )}
                                    {selectedAlert.termination_reason && (
                                        <p className="mt-2 text-gray-700 bg-gray-50 p-2 rounded text-xs italic border border-gray-200">
                                            "{selectedAlert.termination_reason}"
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                    <MapPin className="h-16 w-16 mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-500">Selecione uma ocorrência para ver detalhes</p>
                </div>
            )}
        </main>
      </div>

      {/* Modal de Validação de Token */}
      {showValidationModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2">
                        <Shield size={20} /> Validação Policial
                    </h3>
                    <button onClick={() => setShowValidationModal(false)} className="hover:text-white/80">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleValidateToken} className="p-6">
                    <p className="text-sm text-gray-600 mb-6">
                        Insira o token de 6 dígitos fornecido pelo motorista para confirmar sua identidade e encerrar o alerta de segurança.
                    </p>
                    
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Token de Segurança
                        </label>
                        <input
                            type="text"
                            maxLength={6}
                            value={validationToken}
                            onChange={(e) => setValidationToken(e.target.value.toUpperCase())}
                            placeholder="Ex: AB12CD"
                            className="w-full text-center text-3xl font-mono tracking-widest border-2 border-gray-300 rounded-lg p-3 focus:border-blue-500 focus:ring-blue-500 uppercase"
                            autoFocus
                        />
                        {validationError && (
                            <p className="text-red-600 text-sm mt-2 flex items-center gap-1 justify-center animate-shake">
                                <AlertTriangle size={14} /> {validationError}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isValidating || validationToken.length < 6}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {isValidating ? 'Verificando...' : 'Validar e Encerrar Ocorrência'}
                    </button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
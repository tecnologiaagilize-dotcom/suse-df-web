import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Stethoscope, Users, Calendar, QrCode, FileText, 
  LogOut, UserCheck, AlertCircle, Search 
} from 'lucide-react';

export default function ProfessionalDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingReviews: 0,
    activePatients: 0
  });

  useEffect(() => {
    // Simular carregamento de estatísticas
    // Futuro: Buscar via RPC
    setTimeout(() => {
        setStats({
            todayAppointments: 12,
            pendingReviews: 3,
            activePatients: 45
        });
        setLoading(false);
    }, 1000);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/professional/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Stethoscope className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">Portal do Profissional</h1>
                <p className="text-xs text-gray-500">Sistema de Saúde Integrado</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                <p className="text-xs text-gray-500">Médico Responsável</p>
              </div>
              <button 
                onClick={handleSignOut}
                className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Ações Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Card 1: Ler QR Code */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition duration-200 cursor-pointer"
                 onClick={() => navigate('/professional/scan')}>
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                        <QrCode className="w-8 h-8 text-white" />
                    </div>
                    <span className="bg-blue-500 text-xs font-bold px-2 py-1 rounded border border-blue-400">Acesso Rápido</span>
                </div>
                <h3 className="text-lg font-bold mb-1">Iniciar Atendimento</h3>
                <p className="text-blue-100 text-sm">Escanear QR Code do paciente para acessar prontuário.</p>
            </div>

            {/* Card 2: Buscar Paciente */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition cursor-pointer"
                 onClick={() => navigate('/professional/patients')}>
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-purple-100 p-3 rounded-lg">
                        <Search className="w-8 h-8 text-purple-600" />
                    </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">Buscar Paciente</h3>
                <p className="text-gray-500 text-sm">Localizar por CPF, nome ou cartão SUS.</p>
            </div>

            {/* Card 3: Agenda */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-green-100 p-3 rounded-lg">
                        <Calendar className="w-8 h-8 text-green-600" />
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">Hoje</span>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">Minha Agenda</h3>
                <p className="text-gray-500 text-sm">
                    <strong className="text-gray-900">{stats.todayAppointments}</strong> atendimentos agendados.
                </p>
            </div>
        </div>

        {/* Estatísticas e Pendências */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <AlertCircle className="text-orange-500" /> Pendências e Alertas
                </h3>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800">Revisão de Exames - Paciente #{100+i}</p>
                                <p className="text-xs text-gray-500">Aguardando análise desde ontem.</p>
                            </div>
                            <button className="text-xs text-blue-600 font-medium hover:underline">Ver</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <UserCheck className="text-blue-500" /> Últimos Atendimentos
                </h3>
                <div className="divide-y divide-gray-100">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="py-3 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-medium text-gray-800">Maria Silva</p>
                                <p className="text-xs text-gray-500">Consulta de Rotina • 10:30</p>
                            </div>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Concluído</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}
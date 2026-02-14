import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Calendar, Activity, FileText, Plus, Save, Clock, 
  Stethoscope, AlertCircle, CheckCircle, ArrowLeft, History
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function PatientRecord() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState(null);
  const [activeTab, setActiveTab] = useState('summary'); // summary, history, new
  
  // Estado para novo registro de atendimento
  const [newRecord, setNewRecord] = useState({
    subject: '',
    description: '',
    vitals: { bp: '', hr: '', temp: '', spo2: '' },
    prescription: ''
  });

  useEffect(() => {
    // Simulação de busca de dados completos do paciente
    // Em produção: supabase.rpc('get_full_patient_record', { token })
    setTimeout(() => {
        setPatientData({
            personal: {
                full_name: 'Maria Silva',
                social_name: '',
                birth_date: '1985-04-12',
                blood_type: 'O+',
                gender: 'Feminino',
                cpf: '***.456.789-**'
            },
            history: [
                { date: '2023-10-15', type: 'Emergência', doctor: 'Dr. João', note: 'Crise alérgica leve.' },
                { date: '2023-08-20', type: 'Consulta', doctor: 'Dra. Ana', note: 'Check-up de rotina.' }
            ],
            allergies: [{ allergen: 'Dipirona', severity: 'Alta' }],
            medications: [{ name: 'Losartana', dosage: '50mg', frequency: '1x dia' }]
        });
        setLoading(false);
    }, 1000);
  }, [token]);

  const handleSaveRecord = () => {
      alert('Registro salvo com sucesso no prontuário!');
      setActiveTab('history');
      // Lógica real de insert no banco
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Carregando Prontuário...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Profissional */}
      <header className="bg-blue-900 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/professional/dashboard')} className="p-2 hover:bg-white/10 rounded-full">
                    <ArrowLeft />
                </button>
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Stethoscope size={20} /> Prontuário Eletrônico
                    </h1>
                    <p className="text-xs text-blue-200">Acesso Médico Autorizado</p>
                </div>
            </div>
            <div className="text-right">
                <p className="font-bold">{patientData?.personal.full_name}</p>
                <p className="text-xs opacity-75">Nasc: {patientData?.personal.birth_date}</p>
            </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar: Resumo Rápido */}
        <aside className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-gray-100 p-3 rounded-full">
                        <User className="w-8 h-8 text-gray-600" />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">{patientData?.personal.blood_type}</p>
                        <p className="text-xs text-gray-500">Tipo Sanguíneo</p>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                        <span className="text-xs font-bold text-red-800 uppercase flex items-center gap-1">
                            <AlertCircle size={12} /> Alergias
                        </span>
                        <p className="text-sm text-gray-800 mt-1">
                            {patientData?.allergies.map(a => a.allergen).join(', ')}
                        </p>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <span className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1">
                            <Activity size={12} /> Medicamentos
                        </span>
                        <p className="text-sm text-gray-800 mt-1">
                            {patientData?.medications.map(m => m.name).join(', ')}
                        </p>
                    </div>
                </div>
            </div>
        </aside>

        {/* Área Principal */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button 
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 py-4 text-sm font-medium text-center border-b-2 transition ${activeTab === 'summary' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Resumo Clínico
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-4 text-sm font-medium text-center border-b-2 transition ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    Histórico
                </button>
                <button 
                    onClick={() => setActiveTab('new')}
                    className={`flex-1 py-4 text-sm font-medium text-center border-b-2 transition ${activeTab === 'new' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <Plus size={16} /> Novo Registro
                    </span>
                </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 flex-1 overflow-y-auto">
                {activeTab === 'summary' && (
                    <div className="space-y-6">
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                            <h3 className="font-bold text-yellow-800 mb-2">Notas Recentes</h3>
                            <p className="text-sm text-gray-800">Paciente com histórico de hipertensão leve. Monitorar PA em todas as visitas.</p>
                        </div>
                        
                        <div>
                            <h3 className="font-bold text-gray-800 mb-3">Últimos Sinais Vitais (20/08/2023)</h3>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="text-center p-3 bg-gray-50 rounded-lg">
                                    <span className="text-xs text-gray-500 block">PA</span>
                                    <span className="font-bold text-gray-900">120/80</span>
                                </div>
                                <div className="text-center p-3 bg-gray-50 rounded-lg">
                                    <span className="text-xs text-gray-500 block">FC</span>
                                    <span className="font-bold text-gray-900">72 bpm</span>
                                </div>
                                <div className="text-center p-3 bg-gray-50 rounded-lg">
                                    <span className="text-xs text-gray-500 block">Temp</span>
                                    <span className="font-bold text-gray-900">36.5°C</span>
                                </div>
                                <div className="text-center p-3 bg-gray-50 rounded-lg">
                                    <span className="text-xs text-gray-500 block">SpO2</span>
                                    <span className="font-bold text-gray-900">98%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-4">
                        {patientData?.history.map((record, idx) => (
                            <div key={idx} className="flex gap-4 p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
                                <div className="flex flex-col items-center min-w-[80px]">
                                    <div className="bg-blue-100 text-blue-700 p-2 rounded-lg mb-1">
                                        <Calendar size={20} />
                                    </div>
                                    <span className="text-xs font-medium text-gray-500">{new Date(record.date).toLocaleDateString()}</span>
                                </div>
                                <div>
                                    <div className="flex justify-between items-start w-full">
                                        <h4 className="font-bold text-gray-900">{record.type}</h4>
                                        <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">{record.doctor}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{record.note}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'new' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Tipo de Atendimento</label>
                                <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                    <option>Emergência</option>
                                    <option>Consulta Ambulatorial</option>
                                    <option>Retorno</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Assunto Principal</label>
                                <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Ex: Dor abdominal" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Sinais Vitais</label>
                            <div className="grid grid-cols-4 gap-4">
                                <input type="text" placeholder="PA (mmHg)" className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-center" />
                                <input type="text" placeholder="FC (bpm)" className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-center" />
                                <input type="text" placeholder="Temp (°C)" className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-center" />
                                <input type="text" placeholder="SpO2 (%)" className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-center" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Evolução Médica</label>
                            <textarea rows={4} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Descreva o quadro clínico e procedimentos..."></textarea>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button 
                                onClick={handleSaveRecord}
                                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 shadow-sm font-medium"
                            >
                                <Save size={18} /> Salvar Registro
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </main>
    </div>
  );
}
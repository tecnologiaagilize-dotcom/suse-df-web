import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Calendar, Activity, FileText, Plus, Save, Clock, 
  Stethoscope, AlertCircle, CheckCircle, ArrowLeft, History
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function PatientRecord() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('summary');
  
  // Estado para novo registro
  const [newRecord, setNewRecord] = useState({
    type: 'Emergência',
    subject: '',
    description: '',
    vitals: { bp: '', hr: '', temp: '', spo2: '' },
    prescription: ''
  });

  useEffect(() => {
    fetchPatientData();
  }, [token]);

  const fetchPatientData = async () => {
    try {
        setLoading(true);

        // 1. Obter ID do Paciente através do Token QR
        const { data: qrData, error: qrError } = await supabase
            .from('qrcodes')
            .select('profile_id')
            .eq('id', token)
            .single();
            
        if (qrError || !qrData) throw new Error('Paciente não encontrado ou QR Code inválido.');
        
        const pid = qrData.profile_id;
        setPatientId(pid);

        // 2. Buscar Dados Básicos (Paralelo)
        const [profileRes, healthRes, allergiesRes, medsRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', pid).single(),
            supabase.from('health_profiles').select('*').eq('profile_id', pid).single(),
            supabase.from('allergies').select('*').eq('profile_id', pid),
            supabase.from('medications').select('*').eq('profile_id', pid)
        ]);

        // 3. Buscar Histórico Médico (Se existir a tabela e a RPC)
        // Tentamos via RPC primeiro, se falhar, tentamos query direta (se RLS permitir)
        let historyData = [];
        try {
            const { data: rpcHistory, error: rpcError } = await supabase.rpc('get_patient_history', { p_patient_id: pid });
            if (!rpcError) {
                historyData = rpcHistory;
            } else {
                // Fallback: Query direta se RPC falhar (e RLS permitir)
                console.warn("RPC get_patient_history falhou, tentando query direta:", rpcError);
                const { data: directHistory } = await supabase
                    .from('medical_records')
                    .select('*, profiles:professional_id(full_name)')
                    .eq('patient_id', pid)
                    .order('created_at', { ascending: false });
                
                if (directHistory) {
                    historyData = directHistory.map(h => ({
                        id: h.id,
                        date: h.created_at,
                        type: h.type,
                        subject: h.subject,
                        description: h.description,
                        vitals: h.vitals,
                        prescription: h.prescription,
                        doctor: h.profiles?.full_name || 'Profissional'
                    }));
                }
            }
        } catch (e) {
            console.error("Erro ao buscar histórico:", e);
        }

        setPatientData({
            personal: profileRes.data,
            health: healthRes.data || {},
            allergies: allergiesRes.data || [],
            medications: medsRes.data || []
        });
        setHistory(historyData || []);

    } catch (error) {
        console.error("Erro ao carregar prontuário:", error);
        alert("Erro ao carregar dados do paciente: " + error.message);
        navigate('/professional/dashboard');
    } finally {
        setLoading(false);
    }
  };

  const handleSaveRecord = async () => {
      if (!newRecord.subject || !newRecord.description) {
          alert("Preencha o assunto e a descrição.");
          return;
      }

      try {
          setSaving(true);
          
          const recordToSave = {
              patient_id: patientId,
              professional_id: user.id,
              type: newRecord.type,
              subject: newRecord.subject,
              description: newRecord.description,
              vitals: newRecord.vitals,
              prescription: newRecord.prescription
          };

          const { error } = await supabase.from('medical_records').insert([recordToSave]);

          if (error) throw error;

          alert('Registro salvo com sucesso!');
          
          // Reset form e recarregar histórico
          setNewRecord({
            type: 'Emergência',
            subject: '',
            description: '',
            vitals: { bp: '', hr: '', temp: '', spo2: '' },
            prescription: ''
          });
          setActiveTab('history');
          fetchPatientData(); // Recarrega tudo para atualizar histórico

      } catch (error) {
          console.error("Erro ao salvar:", error);
          alert("Erro ao salvar registro: " + error.message);
      } finally {
          setSaving(false);
      }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50 flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
        <p className="text-gray-600 font-medium">Acessando Prontuário Seguro...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Profissional */}
      <header className="bg-blue-900 text-white p-4 shadow-lg sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate('/professional/dashboard')} className="p-2 hover:bg-white/10 rounded-full transition">
                    <ArrowLeft />
                </button>
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Stethoscope size={20} /> Prontuário Eletrônico
                    </h1>
                    <p className="text-xs text-blue-200 flex items-center gap-1">
                        <CheckCircle size={10} /> Acesso Médico Autorizado
                    </p>
                </div>
            </div>
            <div className="text-right">
                <p className="font-bold text-lg">{patientData?.personal?.full_name}</p>
                <div className="flex items-center justify-end gap-2 text-xs opacity-75">
                    <span>CPF: {patientData?.personal?.cpf || '---'}</span>
                    <span>•</span>
                    <span>Nasc: {patientData?.personal?.birth_date ? new Date(patientData.personal.birth_date).toLocaleDateString() : '--/--/----'}</span>
                </div>
            </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar: Resumo Rápido */}
        <aside className="lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-4 mb-6">
                    <div className="bg-blue-50 p-3 rounded-full">
                        <User className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-2xl font-black text-gray-900">{patientData?.personal?.blood_type || '?'}</p>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Tipo Sanguíneo</p>
                    </div>
                </div>
                
                <div className="space-y-3">
                    <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                        <span className="text-xs font-bold text-red-800 uppercase flex items-center gap-1 mb-2">
                            <AlertCircle size={14} /> Alergias
                        </span>
                        {patientData?.allergies?.length > 0 ? (
                            <ul className="space-y-1">
                                {patientData.allergies.map((a, i) => (
                                    <li key={i} className="text-sm text-red-900 font-medium">• {a.allergen}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic">Nenhuma registrada.</p>
                        )}
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <span className="text-xs font-bold text-blue-800 uppercase flex items-center gap-1 mb-2">
                            <Activity size={14} /> Medicamentos
                        </span>
                        {patientData?.medications?.length > 0 ? (
                            <ul className="space-y-1">
                                {patientData.medications.map((m, i) => (
                                    <li key={i} className="text-sm text-blue-900 font-medium">• {m.name}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic">Nenhum registrado.</p>
                        )}
                    </div>

                    {patientData?.health?.sus_card && (
                        <div className="p-3 bg-gray-100 rounded-lg text-center">
                            <p className="text-xs text-gray-500 uppercase">Cartão SUS</p>
                            <p className="font-mono font-bold text-gray-800">{patientData.health.sus_card}</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>

        {/* Área Principal */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-[600px]">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                <button 
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition ${activeTab === 'summary' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    Resumo Clínico
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition ${activeTab === 'history' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    Histórico ({history.length})
                </button>
                <button 
                    onClick={() => setActiveTab('new')}
                    className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition ${activeTab === 'new' ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <span className="flex items-center justify-center gap-2">
                        <Plus size={16} /> Novo Atendimento
                    </span>
                </button>
            </div>

            {/* Conteúdo */}
            <div className="p-6 flex-1 overflow-y-auto bg-gray-50/50">
                {activeTab === 'summary' && (
                    <div className="space-y-6">
                        {patientData?.health?.additional_notes && (
                            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-sm">
                                <h3 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                    <FileText size={16} /> Notas Importantes
                                </h3>
                                <p className="text-sm text-gray-800 italic">"{patientData.health.additional_notes}"</p>
                            </div>
                        )}
                        
                        {history.length > 0 ? (
                            <div>
                                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    <Activity size={18} className="text-blue-600" /> Últimos Sinais Vitais
                                </h3>
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                    <p className="text-xs text-gray-400 mb-4 text-right">
                                        Registrado em: {new Date(history[0].date).toLocaleDateString()}
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                                            <span className="text-xs text-gray-500 block uppercase">Pressão Arterial</span>
                                            <span className="font-bold text-xl text-gray-900">{history[0].vitals?.bp || '--'}</span>
                                            <span className="text-xs text-gray-400">mmHg</span>
                                        </div>
                                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                                            <span className="text-xs text-gray-500 block uppercase">Freq. Cardíaca</span>
                                            <span className="font-bold text-xl text-gray-900">{history[0].vitals?.hr || '--'}</span>
                                            <span className="text-xs text-gray-400">bpm</span>
                                        </div>
                                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                                            <span className="text-xs text-gray-500 block uppercase">Temperatura</span>
                                            <span className="font-bold text-xl text-gray-900">{history[0].vitals?.temp || '--'}</span>
                                            <span className="text-xs text-gray-400">°C</span>
                                        </div>
                                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                                            <span className="text-xs text-gray-500 block uppercase">Saturação</span>
                                            <span className="font-bold text-xl text-gray-900">{history[0].vitals?.spo2 || '--'}</span>
                                            <span className="text-xs text-gray-400">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                             <div className="text-center py-10 text-gray-400">
                                 <p>Nenhum registro de sinais vitais anterior.</p>
                             </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-4">
                        {history.length === 0 ? (
                            <div className="text-center py-10">
                                <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">Nenhum histórico médico encontrado.</p>
                            </div>
                        ) : (
                            history.map((record, idx) => (
                                <div key={idx} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition">
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <div className="flex flex-col items-center min-w-[100px] border-r border-gray-100 pr-4">
                                            <div className="bg-blue-100 text-blue-700 p-2 rounded-lg mb-1">
                                                <Calendar size={20} />
                                            </div>
                                            <span className="text-sm font-bold text-gray-700">{new Date(record.date).toLocaleDateString()}</span>
                                            <span className="text-xs text-gray-400">{new Date(record.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start w-full mb-2">
                                                <div>
                                                    <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded uppercase mb-1">
                                                        {record.type}
                                                    </span>
                                                    <h4 className="font-bold text-lg text-gray-900">{record.subject}</h4>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-600 flex items-center gap-1">
                                                        <Stethoscope size={12} /> {record.doctor}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 mb-3">
                                                {record.description}
                                            </div>

                                            {(record.vitals?.bp || record.vitals?.temp) && (
                                                <div className="flex gap-4 text-xs text-gray-500 border-t border-gray-100 pt-2">
                                                    {record.vitals.bp && <span><strong>PA:</strong> {record.vitals.bp}</span>}
                                                    {record.vitals.hr && <span><strong>FC:</strong> {record.vitals.hr}</span>}
                                                    {record.vitals.temp && <span><strong>Temp:</strong> {record.vitals.temp}°C</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'new' && (
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Atendimento</label>
                                <select 
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                                    value={newRecord.type}
                                    onChange={e => setNewRecord({...newRecord, type: e.target.value})}
                                >
                                    <option>Emergência</option>
                                    <option>Consulta Ambulatorial</option>
                                    <option>Retorno</option>
                                    <option>Exame</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Assunto Principal</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" 
                                    placeholder="Ex: Dor abdominal aguda, Suspeita de fratura..." 
                                    value={newRecord.subject}
                                    onChange={e => setNewRecord({...newRecord, subject: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <label className="block text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                                <Activity size={16} /> Sinais Vitais
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <span className="text-xs text-gray-500 mb-1 block">PA (mmHg)</span>
                                    <input 
                                        type="text" 
                                        placeholder="120/80" 
                                        className="w-full rounded-md border-gray-300 shadow-sm p-2 border text-center font-mono"
                                        value={newRecord.vitals.bp}
                                        onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, bp: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 mb-1 block">FC (bpm)</span>
                                    <input 
                                        type="text" 
                                        placeholder="72" 
                                        className="w-full rounded-md border-gray-300 shadow-sm p-2 border text-center font-mono"
                                        value={newRecord.vitals.hr}
                                        onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, hr: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 mb-1 block">Temp (°C)</span>
                                    <input 
                                        type="text" 
                                        placeholder="36.5" 
                                        className="w-full rounded-md border-gray-300 shadow-sm p-2 border text-center font-mono"
                                        value={newRecord.vitals.temp}
                                        onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, temp: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 mb-1 block">SpO2 (%)</span>
                                    <input 
                                        type="text" 
                                        placeholder="98" 
                                        className="w-full rounded-md border-gray-300 shadow-sm p-2 border text-center font-mono"
                                        value={newRecord.vitals.spo2}
                                        onChange={e => setNewRecord({...newRecord, vitals: {...newRecord.vitals, spo2: e.target.value}})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Evolução Médica / Descrição</label>
                            <textarea 
                                rows={6} 
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border" 
                                placeholder="Descreva o quadro clínico, observações do exame físico e conduta..."
                                value={newRecord.description}
                                onChange={e => setNewRecord({...newRecord, description: e.target.value})}
                            ></textarea>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Prescrição / Orientações</label>
                            <textarea 
                                rows={3} 
                                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 border" 
                                placeholder="Medicamentos receitados ou orientações de alta..."
                                value={newRecord.prescription}
                                onChange={e => setNewRecord({...newRecord, prescription: e.target.value})}
                            ></textarea>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button 
                                onClick={handleSaveRecord}
                                disabled={saving}
                                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 shadow-lg font-bold transition transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
                            >
                                <Save size={20} /> {saving ? 'Salvando...' : 'Finalizar Atendimento'}
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
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Save, Plus, Trash2, Activity, User, QrCode as QrIcon, Brain, Shield, RefreshCw } from 'lucide-react';
import HealthAI from './HealthAI';
import AuditView from './AuditView';

export default function HealthProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personal');
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);

  // Dados
  const [profile, setProfile] = useState({
    full_name: '',
    social_name: '',
    cpf: '',
    birth_date: '',
    blood_type: '',
    gender: 'N'
  });

  const [health, setHealth] = useState({
    sus_card: '',
    organ_donor: false,
    additional_notes: '',
    health_insurance: { nome: '', numero: '' }
  });

  const [allergies, setAllergies] = useState([]);
  const [medications, setMedications] = useState([]);
  const [qrCodeData, setQrCodeData] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      setUserId(user.id);

      // 1. Fetch Profile
      let { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profileData) {
        // Create if not exists (should be done on signup, but fallback here)
        const { data: newProfile } = await supabase
            .from('profiles')
            .insert([{ id: user.id, full_name: user.user_metadata?.name || '' }])
            .select()
            .single();
        profileData = newProfile;
      }
      setProfile(profileData || {});

      // 2. Fetch Health Profile
      let { data: healthData } = await supabase
        .from('health_profiles')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      if (!healthData) {
         // Create default health profile
         const { data: newHealth } = await supabase
            .from('health_profiles')
            .insert([{ profile_id: user.id }])
            .select()
            .single();
         healthData = newHealth;
      }
      setHealth({
        ...healthData,
        health_insurance: healthData.health_insurance || { nome: '', numero: '' }
      });

      // 3. Fetch Allergies & Meds
      const { data: allergiesData } = await supabase.from('allergies').select('*').eq('profile_id', user.id);
      setAllergies(allergiesData || []);

      const { data: medsData } = await supabase.from('medications').select('*').eq('profile_id', user.id);
      setMedications(medsData || []);

      // 4. Generate QR Code (if needed)
      // Check existing QR
      const { data: qrData } = await supabase.from('qrcodes').select('*').eq('profile_id', user.id).eq('is_active', true).single();
      if (qrData) {
          setQrCodeData(qrData.id); // Usar ID como token
      } else {
          // Generate new one via RPC
          const { error: rpcError } = await supabase.rpc('generate_qrcode');
          if (!rpcError) {
             // Fetch the newly created ID
             const { data: createdQr } = await supabase.from('qrcodes').select('id').eq('profile_id', user.id).eq('is_active', true).single();
             if (createdQr) setQrCodeData(createdQr.id);
          }
      }

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePersonal = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('profiles').update(profile).eq('id', user.id);
      alert('Dados pessoais salvos com sucesso!');
    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHealth = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('health_profiles').update(health).eq('profile_id', user.id);
      alert('Ficha médica atualizada!');
    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // --- Sub-components (Simplified for brevity) ---
  const AddAllergy = async () => {
    const allergen = prompt('Nome da alergia:');
    if (!allergen) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('allergies').insert([{ profile_id: user.id, allergen, severity: 'unknown' }]).select();
    if (data) setAllergies([...allergies, data[0]]);
  };

  const RemoveAllergy = async (id) => {
    await supabase.from('allergies').delete().eq('id', id);
    setAllergies(allergies.filter(a => a.id !== id));
  };

  const handleRegenerateQR = async () => {
    if (!userId) return;
    try {
        setLoading(true);
        // Desativa o anterior
        if (qrCodeData) {
            await supabase.from('qrcodes').update({ is_active: false }).eq('id', qrCodeData);
        }
        
        // Gera um novo
        const { error: rpcError } = await supabase.rpc('generate_qrcode');
        if (rpcError) throw rpcError;
        
        // Busca o novo ID
        const { data: createdQr } = await supabase.from('qrcodes').select('id').eq('profile_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(1).single();
        
        if (createdQr) {
            setQrCodeData(createdQr.id);
            alert('Novo QR Code gerado com sucesso!');
        }
    } catch (error) {
        console.error("Erro ao regerar QR:", error);
        alert("Falha ao atualizar QR Code.");
    } finally {
        setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando perfil de saúde...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">Minha Saúde</h1>
        </div>
        
        {/* Tabs */}
        <div className="flex mt-4 border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('personal')}
            className={`flex-1 pb-3 text-sm font-medium ${activeTab === 'personal' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            Pessoal
          </button>
          <button 
            onClick={() => setActiveTab('health')}
            className={`flex-1 pb-3 text-sm font-medium ${activeTab === 'health' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            Ficha Médica
          </button>
          <button 
            onClick={() => setActiveTab('qrcode')}
            className={`flex-1 pb-3 text-sm font-medium ${activeTab === 'qrcode' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            Carteira QR
          </button>
          <button 
            onClick={() => setActiveTab('ai')}
            className={`flex-1 pb-3 text-sm font-medium ${activeTab === 'ai' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
          >
            IA Análise
          </button>
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        
        {/* TAB: DADOS PESSOAIS */}
        {activeTab === 'personal' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-500" /> Identificação
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  value={profile.full_name || ''}
                  onChange={e => setProfile({...profile, full_name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">CPF</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  value={profile.cpf || ''}
                  onChange={e => setProfile({...profile, cpf: e.target.value})}
                  placeholder="000.000.000-00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nascimento</label>
                  <input 
                    type="date" 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                    value={profile.birth_date || ''}
                    onChange={e => setProfile({...profile, birth_date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sexo</label>
                  <select 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                    value={profile.gender || 'N'}
                    onChange={e => setProfile({...profile, gender: e.target.value})}
                  >
                    <option value="N">Não informar</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                    <option value="O">Outro</option>
                  </select>
                </div>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo Sanguíneo</label>
                  <select 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                    value={profile.blood_type || 'UNKNOWN'}
                    onChange={e => setProfile({...profile, blood_type: e.target.value})}
                  >
                    <option value="UNKNOWN">Não sei</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
              </div>
            </div>

            <button 
              onClick={handleSavePersonal}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              <Save className="w-5 h-5" /> {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        )}

        {/* TAB: FICHA MÉDICA */}
        {activeTab === 'health' && (
          <div className="space-y-4">
             <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                <Activity className="w-5 h-5 text-red-500" /> Dados Clínicos
              </h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Cartão SUS</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  value={health.sus_card || ''}
                  onChange={e => setHealth({...health, sus_card: e.target.value})}
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="donor"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={health.organ_donor || false}
                  onChange={e => setHealth({...health, organ_donor: e.target.checked})}
                />
                <label htmlFor="donor" className="text-sm font-medium text-gray-700">Sou doador de órgãos</label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Plano de Saúde (Nome)</label>
                <input 
                  type="text" 
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                  value={health.health_insurance?.nome || ''}
                  onChange={e => setHealth({...health, health_insurance: { ...health.health_insurance, nome: e.target.value }})}
                />
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-700">Alergias</label>
                 <div className="mt-2 space-y-2">
                    {allergies.map(a => (
                        <div key={a.id} className="flex justify-between items-center bg-red-50 p-2 rounded text-red-700 text-sm">
                            <span>{a.allergen} ({a.severity})</span>
                            <button onClick={() => RemoveAllergy(a.id)}><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                    <button onClick={AddAllergy} className="text-sm text-blue-600 flex items-center gap-1 font-medium">
                        <Plus className="w-4 h-4" /> Adicionar Alergia
                    </button>
                 </div>
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-700">Notas Adicionais</label>
                 <textarea 
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
                    rows="3"
                    value={health.additional_notes || ''}
                    onChange={e => setHealth({...health, additional_notes: e.target.value})}
                 ></textarea>
              </div>
            </div>

            <button 
              onClick={handleSaveHealth}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              <Save className="w-5 h-5" /> {saving ? 'Salvar Ficha' : 'Atualizar Ficha'}
            </button>
          </div>
        )}

        {/* TAB: QR CODE */}
        {activeTab === 'qrcode' && (
          <div className="flex flex-col items-center justify-center space-y-6 py-8">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                {qrCodeData ? (
                    <QRCodeSVG 
                        value={`${window.location.origin}/health/check/${qrCodeData}`} 
                        size={256} 
                        level="H" 
                        includeMargin={true}
                    />
                ) : (
                    <div className="w-64 h-64 bg-gray-200 flex items-center justify-center text-gray-500">
                        Gerando QR...
                    </div>
                )}
            </div>
            
            <button 
                onClick={handleRegenerateQR}
                className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:text-blue-800"
            >
                <RefreshCw size={16} /> Regerar Código de Segurança
            </button>

            <p className="text-center text-gray-600 max-w-xs text-sm">
                Apresente este código para profissionais de saúde ou socorristas em caso de emergência.
            </p>
            <div className="bg-yellow-50 p-4 rounded-lg text-yellow-800 text-xs max-w-xs">
                <strong>Atenção:</strong> Este código permite acesso temporário aos seus dados vitais e histórico médico.
            </div>
            
            <AuditView />
          </div>
        )}

        {/* TAB: IA GENERATIVA */}
        {activeTab === 'ai' && (
            <HealthAI profileId={userId} />
        )}

      </div>
    </div>
  );
}

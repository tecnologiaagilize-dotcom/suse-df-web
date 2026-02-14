import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Phone, FileText, Mail, ArrowLeft, Mic, Camera, MapPin, Save, Users, Plus, Trash } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function PassengerProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone_number: '',
    cpf: '',
    secret_word: '',
    photo_url: '',
    emergency_contacts: [],
    address: {
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: ''
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile({
          name: data.name || '',
          email: data.email || user.email,
          phone_number: data.phone_number || '',
          cpf: data.cpf || '',
          secret_word: data.secret_word || '',
          photo_url: data.photo_url || '',
          emergency_contacts: data.emergency_contacts || [],
          address: data.address || {
            cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: ''
          }
        });
      } else {
        setProfile(prev => ({
          ...prev,
          name: user.user_metadata?.name || '',
          email: user.email,
          phone_number: user.user_metadata?.phone_number || '',
          cpf: user.user_metadata?.cpf || '',
          secret_word: user.user_metadata?.emergency_phrase || ''
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setProfile(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setProfile(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCepBlur = async (e) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setProfile(prev => ({
            ...prev,
            address: {
              ...prev.address,
              street: data.logradouro,
              neighborhood: data.bairro,
              city: data.localidade,
              state: data.uf
            }
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      }
    }
  };

  const handleAddContact = () => {
    setProfile(prev => ({
      ...prev,
      emergency_contacts: [...prev.emergency_contacts, { name: '', relationship: '', phone: '', address: '' }]
    }));
  };

  const handleRemoveContact = (index) => {
    setProfile(prev => ({
      ...prev,
      emergency_contacts: prev.emergency_contacts.filter((_, i) => i !== index)
    }));
  };

  const handleContactChange = (index, field, value) => {
    const newContacts = [...profile.emergency_contacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setProfile(prev => ({ ...prev, emergency_contacts: newContacts }));
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      setShowCamera(false);
      if (fileInputRef.current) fileInputRef.current.click();
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, photo_url: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoDataUrl = canvas.toDataURL('image/jpeg');
      setProfile(prev => ({ ...prev, photo_url: photoDataUrl }));
      const stream = video.srcObject;
      stream.getTracks().forEach(track => track.stop());
      setShowCamera(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('users').upsert({
        id: user.id,
        ...profile,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      alert('Perfil atualizado com sucesso!');
      navigate('/passenger/dashboard');
    } catch (error) {
      alert(`Erro ao salvar alterações: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Carregando dados...</div>;

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => navigate('/passenger/dashboard')} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" /> Voltar ao Painel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700">
            <Save className="h-4 w-4 mr-2" /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Foto */}
          <div className="bg-gray-50 px-4 py-5 flex flex-col items-center border-b border-gray-200">
             <div className="relative group cursor-pointer" onClick={startCamera}>
                {profile.photo_url ? (
                  <img src={profile.photo_url} alt="Foto" className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-lg" />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow-lg text-gray-400">
                    <Camera className="h-12 w-12" />
                  </div>
                )}
             </div>
             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
             
             {showCamera && (
               <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                 <div className="bg-white rounded-lg p-4 w-full max-w-md">
                    <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg mb-4" />
                    <div className="flex justify-end space-x-2">
                      <button onClick={() => setShowCamera(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                      <button onClick={takePhoto} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Capturar</button>
                    </div>
                 </div>
               </div>
             )}
             <canvas ref={canvasRef} className="hidden" />
          </div>
          
          <div className="px-4 py-5 space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                <input type="text" name="name" value={profile.name} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="text" name="email" value={profile.email} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Telefone</label>
                <input type="text" name="phone_number" value={profile.phone_number} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">CPF</label>
                <input type="text" name="cpf" value={profile.cpf} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              {/* Endereço */}
              <div className="sm:col-span-6 border-t border-gray-200 pt-6 mt-2">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-gray-500" /> Endereço Completo
                </h4>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">CEP</label>
                <input type="text" name="address.cep" value={profile.address.cep} onChange={handleInputChange} onBlur={handleCepBlur} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-gray-700">Logradouro</label>
                <input type="text" name="address.street" value={profile.address.street} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Número</label>
                <input type="text" name="address.number" value={profile.address.number} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Complemento</label>
                <input type="text" name="address.complement" value={profile.address.complement} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Bairro</label>
                <input type="text" name="address.neighborhood" value={profile.address.neighborhood} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Cidade</label>
                <input type="text" name="address.city" value={profile.address.city} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Estado</label>
                <input type="text" name="address.state" value={profile.address.state} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm" />
              </div>

              {/* Contatos */}
              <div className="sm:col-span-6 border-t border-gray-200 pt-6 mt-2">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-lg font-medium text-gray-900 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-gray-500" /> Contatos de Emergência
                  </h4>
                  <button onClick={handleAddContact} className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-1" /> Adicionar
                  </button>
                </div>
                
                <div className="space-y-4">
                  {profile.emergency_contacts.map((contact, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative group">
                      <button onClick={() => handleRemoveContact(index)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600">
                        <Trash className="h-4 w-4" />
                      </button>
                      <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-6">
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-500">Nome</label>
                          <input type="text" value={contact.name} onChange={(e) => handleContactChange(index, 'name', e.target.value)} className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-xs font-medium text-gray-500">Telefone</label>
                          <input type="text" value={contact.phone} onChange={(e) => handleContactChange(index, 'phone', e.target.value)} className="mt-1 block w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="border-t border-gray-200 pt-6 mt-6 space-y-4">
              <button onClick={handleSave} disabled={saving} className="w-full flex justify-center items-center py-3 px-4 rounded-md text-white bg-green-600 hover:bg-green-700">
                <Save className="h-5 w-5 mr-2" /> {saving ? 'Salvando...' : 'Salvar Alterações e Sair'}
              </button>

              <button onClick={() => navigate('/passenger/voice-config')} className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700">
                <Mic className="h-5 w-5 mr-2 text-white" /> Configurar Frases e Voz
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

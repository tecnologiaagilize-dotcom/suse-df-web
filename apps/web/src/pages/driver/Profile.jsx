import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Phone, FileText, Mail, ArrowLeft, Mic, Camera, MapPin, Save, Car, Users, Plus, Trash } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function DriverProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone_number: '',
    cpf: '',
    cnh: '',
    secret_word: '',
    photo_url: '',
    car_brand: '',
    car_model: '',
    car_plate: '',
    car_color: '',
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

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
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
          cnh: data.cnh || '',
          secret_word: data.secret_word || '',
          photo_url: data.photo_url || '',
          car_brand: data.car_brand || '',
          car_model: data.car_model || '',
          car_plate: data.car_plate || '',
          car_color: data.car_color || '',
          emergency_contacts: data.emergency_contacts || [],
          address: data.address || {
            cep: '',
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: ''
          }
        });
      } else {
        setProfile({
          name: user.user_metadata?.name || '',
          email: user.email,
          phone_number: user.user_metadata?.phone_number || '',
          cpf: user.user_metadata?.cpf || '',
          cnh: user.user_metadata?.cnh || '',
          secret_word: user.user_metadata?.emergency_phrase || '',
          photo_url: '',
          car_brand: '',
          car_model: '',
          car_plate: '',
          car_color: '',
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

  const fileInputRef = useRef(null);

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      // Fallback para upload de arquivo se a câmera falhar
      setShowCamera(false);
      if (fileInputRef.current) {
          fileInputRef.current.click();
      } else {
          alert("Câmera não disponível e upload não configurado.");
      }
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
      
      // Stop stream
      const stream = video.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      setShowCamera(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Usar upsert para criar se não existir ou atualizar se existir
      const { error } = await supabase.from('users').upsert({
        id: user.id,
        ...profile,
        updated_at: new Date().toISOString()
      });
      
      if (error) throw error;
      
      // Se houver foto nova (base64), faria upload pro Storage e pegaria a URL pública
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulação
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert(`Erro ao salvar alterações: ${error.message || JSON.stringify(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleVoiceConfig = () => {
    navigate('/driver/voice-config');
  };

  const handleBack = () => {
    navigate('/driver/dashboard');
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Carregando dados...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Voltar ao Painel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          {/* Foto do Usuário */}
          <div className="bg-gray-50 px-4 py-5 sm:px-6 flex flex-col items-center border-b border-gray-200">
             <div className="relative group cursor-pointer" onClick={startCamera}>
                {profile.photo_url ? (
                  <img 
                    src={profile.photo_url} 
                    alt="Foto de Perfil" 
                    className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-lg"
                  />
                ) : (
                  <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow-lg text-gray-400">
                    <Camera className="h-12 w-12" />
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all">
                   <Camera className="h-8 w-8 text-white opacity-0 group-hover:opacity-100" />
                </div>
             </div>
             <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
             />
             <p className="mt-2 text-sm text-gray-500">Toque na foto para alterar</p>
             
             {showCamera && (
               <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                 <div className="bg-white rounded-lg p-4 w-full max-w-md">
                    <h3 className="text-lg font-medium mb-2">Tirar Foto</h3>
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => {
                           setShowCamera(false);
                           const stream = videoRef.current?.srcObject;
                           stream?.getTracks().forEach(t => t.stop());
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={takePhoto}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Capturar
                      </button>
                    </div>
                 </div>
               </div>
             )}
             <canvas ref={canvasRef} className="hidden" />
          </div>
          
          <div className="px-4 py-5 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              
              <div className="sm:col-span-6">
                <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                    <User className="h-5 w-5" />
                  </span>
                  <input
                    type="text"
                    name="name"
                    value={profile.name}
                    onChange={handleInputChange}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                    <Mail className="h-5 w-5" />
                  </span>
                  <input
                    type="text"
                    name="email"
                    value={profile.email}
                    onChange={handleInputChange}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Telefone</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                    <Phone className="h-5 w-5" />
                  </span>
                  <input
                    type="text"
                    name="phone_number"
                    value={profile.phone_number}
                    onChange={handleInputChange}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">CPF</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                    <FileText className="h-5 w-5" />
                  </span>
                  <input
                    type="text"
                    name="cpf"
                    value={profile.cpf}
                    onChange={handleInputChange}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">CNH</label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500">
                    <FileText className="h-5 w-5" />
                  </span>
                  <input
                    type="text"
                    name="cnh"
                    value={profile.cnh}
                    onChange={handleInputChange}
                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md border border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="sm:col-span-6 border-t border-gray-200 pt-6 mt-2">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Car className="h-5 w-5 mr-2 text-gray-500" /> Dados do Veículo
                </h4>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Marca</label>
                <input
                  type="text"
                  name="car_brand"
                  value={profile.car_brand}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Modelo</label>
                <input
                  type="text"
                  name="car_model"
                  value={profile.car_model}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Placa</label>
                <input
                  type="text"
                  name="car_plate"
                  value={profile.car_plate}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Cor</label>
                <input
                  type="text"
                  name="car_color"
                  value={profile.car_color}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              {/* Endereço */}
              <div className="sm:col-span-6 border-t border-gray-200 pt-6 mt-2">
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-gray-500" /> Endereço Completo
                </h4>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">CEP</label>
                <input
                  type="text"
                  name="address.cep"
                  value={profile.address.cep}
                  onChange={handleInputChange}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-gray-700">Logradouro</label>
                <input
                  type="text"
                  name="address.street"
                  value={profile.address.street}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Número</label>
                <input
                  type="text"
                  name="address.number"
                  value={profile.address.number}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Complemento</label>
                <input
                  type="text"
                  name="address.complement"
                  value={profile.address.complement}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Bairro</label>
                <input
                  type="text"
                  name="address.neighborhood"
                  value={profile.address.neighborhood}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Cidade</label>
                <input
                  type="text"
                  name="address.city"
                  value={profile.address.city}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Estado</label>
                <input
                  type="text"
                  name="address.state"
                  value={profile.address.state}
                  onChange={handleInputChange}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Segurança e Voz</h4>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Mic className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Frase de Emergência Atual</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>"{profile.secret_word || 'Não configurada'}"</p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleVoiceConfig}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Mic className="h-5 w-5 mr-2" />
                Regravar Frases e Voz
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

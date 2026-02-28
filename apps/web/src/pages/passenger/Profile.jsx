import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Phone, FileText, Mail, ArrowLeft, Mic, Camera, MapPin, Save, Users, Plus, Trash, Download, ShieldCheck, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function PassengerProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone_number: '',
    cpf: '',
    birth_date: '', // Adicionado
    secret_word: '',
    photo_url: '',
    emergency_contacts: [],
    guardian_info: { // Adicionado para menores
      name: '',
      cpf: '',
      phone: '',
      email: '',
      token: '',
      verified: false
    },
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
  const [isMinor, setIsMinor] = useState(false); // Estado para controle de menor de idade
  const [showGuardianTokenModal, setShowGuardianTokenModal] = useState(false); // Modal de validação
  const [guardianTokenInput, setGuardianTokenInput] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  // Efeito para verificar idade
  useEffect(() => {
    if (profile.birth_date) {
      const birth = new Date(profile.birth_date);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      setIsMinor(age < 18);
    }
  }, [profile.birth_date]);

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
          birth_date: data.birth_date || '', // Carrega data de nascimento
          secret_word: data.secret_word || '',
          photo_url: data.photo_url || '',
          emergency_contacts: data.emergency_contacts || [],
          guardian_info: data.guardian_info || { name: '', cpf: '', phone: '', email: '', token: '', verified: false }, // Carrega responsável
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

  // Função simulada de envio de token
  const sendGuardianToken = async () => {
    if (!profile.guardian_info.email && !profile.guardian_info.phone) {
      alert('Preencha o email ou telefone do responsável.');
      return;
    }
    
    // Simulação: Token fixo para teste
    const mockToken = '123456';
    console.log(`Token enviado para ${profile.guardian_info.email || profile.guardian_info.phone}: ${mockToken}`);
    
    // Atualiza estado local com o token esperado (no mundo real, isso ficaria no backend/redis)
    setProfile(prev => ({
      ...prev,
      guardian_info: { ...prev.guardian_info, token: mockToken } // Apenas para simulação local
    }));
    
    alert(`Token de verificação enviado para o responsável! (Token simulado: ${mockToken})`);
    setShowGuardianTokenModal(true);
  };

  const verifyGuardianToken = () => {
    if (guardianTokenInput === profile.guardian_info.token || guardianTokenInput === '123456') {
      setProfile(prev => ({
        ...prev,
        guardian_info: { ...prev.guardian_info, verified: true }
      }));
      setShowGuardianTokenModal(false);
      alert('Responsável verificado com sucesso!');
    } else {
      alert('Token inválido.');
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
      setPhotoFile(file);
      const objectUrl = URL.createObjectURL(file);
      setProfile(prev => ({ ...prev, photo_url: objectUrl }));
      
      // Cleanup previous objectUrl if exists would be good practice, but for simplicity:
      return () => URL.revokeObjectURL(objectUrl);
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
      
      canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera_photo.jpg", { type: "image/jpeg" });
            setPhotoFile(file);
            
            const photoDataUrl = canvas.toDataURL('image/jpeg');
            setProfile(prev => ({ ...prev, photo_url: photoDataUrl }));
          }
      }, 'image/jpeg', 0.8);

      const stream = video.srcObject;
      stream.getTracks().forEach(track => track.stop());
      setShowCamera(false);
    }
  };

  const handleSave = async () => {
    // Validação de Menor de Idade
    if (isMinor && !profile.guardian_info.verified) {
      alert('ATENÇÃO: Para usuários menores de 18 anos, é obrigatório validar os dados do responsável legal antes de salvar.');
      return;
    }

    setSaving(true);
    try {
      let finalPhotoUrl = profile.photo_url;

      // 1. Se houver nova foto (arquivo), faz upload primeiro
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // Tenta fazer upload no bucket 'avatars'
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, photoFile, { upsert: true });

        if (uploadError) {
             console.error("Erro upload avatars:", uploadError);
             throw new Error("Falha ao salvar foto no servidor. Verifique se o bucket 'avatars' existe.");
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        finalPhotoUrl = publicUrl;
      } else if (profile.photo_url && profile.photo_url.startsWith('blob:')) {
          console.warn("Blob URL detectada sem arquivo correspondente. Ignorando upload de foto.");
      }

      // 2. Salva dados no banco
      const { error } = await supabase.from('users').upsert({
        id: user.id,
        name: profile.name,
        email: profile.email,
        phone_number: profile.phone_number,
        cpf: profile.cpf,
        birth_date: profile.birth_date || null, // Salva data de nascimento
        secret_word: profile.secret_word,
        emergency_contacts: profile.emergency_contacts,
        guardian_info: profile.guardian_info, // Salva dados do responsável
        address: profile.address,
        photo_url: finalPhotoUrl,
        updated_at: new Date().toISOString()
      });
      
      if (error) throw error;
      
      alert('Perfil atualizado com sucesso!');
      navigate('/passenger/dashboard');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert(`Erro ao salvar alterações: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadConsent = () => {
    // Simulação de download de PDF
    const link = document.createElement('a');
    link.href = '/docs/termo_consentimento_menor_suse.pdf'; // Idealmente um link real ou gerado dinamicamente
    link.download = 'Termo_Consentimento_Menor_SUSE.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert('Download do Termo de Consentimento iniciado.');
  };

  if (loading) return <div className="flex justify-center items-center h-screen">Carregando dados...</div>;

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => navigate('/passenger/dashboard')} className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5 mr-2" /> Voltar ao Painel
          </button>
          
          <div className="flex gap-2">
              {isMinor && (
                  <button 
                    onClick={handleDownloadConsent} 
                    className="flex items-center px-4 py-2 rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-200 transition-colors"
                    title="Baixar Termo de Consentimento para Responsável"
                  >
                    <Download className="h-4 w-4 mr-2" /> Termo de Consentimento
                  </button>
              )}
              
              <button onClick={handleSave} disabled={saving} className="flex items-center px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
          </div>
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
                  <User className="h-5 w-5 mr-2 text-gray-500" /> Dados Pessoais
                </h4>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
                <input 
                  type="date" 
                  name="birth_date" 
                  value={profile.birth_date} 
                  onChange={handleInputChange} 
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" 
                />
              </div>

              {/* Seção de Responsável Legal (Visível apenas se for menor de idade) */}
              {isMinor && (
                <div className="sm:col-span-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-4 rounded-r-md animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                    </div>
                    <div className="ml-3 w-full">
                      <h3 className="text-sm font-bold text-yellow-800 uppercase tracking-wide">
                        Usuário Menor de Idade ({new Date().getFullYear() - new Date(profile.birth_date).getFullYear()} anos)
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p className="mb-2">
                          Para prosseguir, é obrigatório informar os dados do responsável legal e validar a autorização via token.
                        </p>
                        
                        <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2 mt-4">
                          <div>
                            <label className="block text-xs font-bold text-yellow-800 uppercase">Nome do Responsável</label>
                            <input 
                              type="text" 
                              value={profile.guardian_info.name} 
                              onChange={(e) => setProfile(prev => ({...prev, guardian_info: {...prev.guardian_info, name: e.target.value}}))}
                              className="mt-1 block w-full px-2 py-1 border border-yellow-300 rounded text-sm" 
                              placeholder="Nome completo"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-yellow-800 uppercase">CPF do Responsável</label>
                            <input 
                              type="text" 
                              value={profile.guardian_info.cpf} 
                              onChange={(e) => setProfile(prev => ({...prev, guardian_info: {...prev.guardian_info, cpf: e.target.value}}))}
                              className="mt-1 block w-full px-2 py-1 border border-yellow-300 rounded text-sm" 
                              placeholder="000.000.000-00"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-yellow-800 uppercase">Telefone do Responsável</label>
                            <input 
                              type="text" 
                              value={profile.guardian_info.phone} 
                              onChange={(e) => setProfile(prev => ({...prev, guardian_info: {...prev.guardian_info, phone: e.target.value}}))}
                              className="mt-1 block w-full px-2 py-1 border border-yellow-300 rounded text-sm" 
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-yellow-800 uppercase">Email do Responsável</label>
                            <input 
                              type="email" 
                              value={profile.guardian_info.email} 
                              onChange={(e) => setProfile(prev => ({...prev, guardian_info: {...prev.guardian_info, email: e.target.value}}))}
                              className="mt-1 block w-full px-2 py-1 border border-yellow-300 rounded text-sm" 
                              placeholder="email@exemplo.com"
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${profile.guardian_info.verified ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                            STATUS: {profile.guardian_info.verified ? 'VERIFICADO' : 'NÃO VERIFICADO'}
                          </span>
                          
                          {!profile.guardian_info.verified && (
                            <button 
                              type="button"
                              onClick={sendGuardianToken}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                            >
                              Enviar Token de Autorização
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="sm:col-span-6 border-t border-gray-200 pt-6 mt-2">

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
              <button onClick={handleSave} disabled={saving} className="w-full flex justify-center items-center py-3 px-4 rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors font-medium">
                <Save className="h-5 w-5 mr-2" /> {saving ? 'Salvando...' : 'Salvar Alterações e Sair'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Modal de Validação de Token do Responsável */}
      {showGuardianTokenModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl transform transition-all">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <ShieldCheck className="mr-2 text-green-600" /> Validar Autorização
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Informe o código de 6 dígitos enviado para o contato do responsável ({profile.guardian_info.email || profile.guardian_info.phone}).
            </p>
            
            <input 
              type="text" 
              maxLength={6}
              value={guardianTokenInput}
              onChange={(e) => setGuardianTokenInput(e.target.value.replace(/\D/g, ''))}
              className="block w-full text-center text-2xl font-mono tracking-widest border-2 border-gray-300 rounded-md py-2 focus:border-blue-500 focus:ring-blue-500 mb-6"
              placeholder="000000"
              autoFocus
            />
            
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowGuardianTokenModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={verifyGuardianToken}
                className="px-4 py-2 bg-green-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-green-700 shadow-sm"
              >
                Validar Código
              </button>
            </div>
            <p className="text-xs text-center text-gray-400 mt-4">
              Token de teste: 123456
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

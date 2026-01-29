import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { UserPlus, Save, AlertCircle, RefreshCw, Trash2, KeyRound } from 'lucide-react';

export default function UserManagement() {
  const { userRole } = useAuth(); // Obter role do contexto
  const [formData, setFormData] = useState({
    name: '',
    matricula: '',
    role: 'operator'
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Buscar usuários ao carregar
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoadingList(true);
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    } finally {
      setLoadingList(false);
    }
  };

  const handleResetPassword = async (email) => {
    if (!window.confirm(`Deseja enviar um email de redefinição de senha para ${email}?`)) return;
    
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/admin/change-password', // Onde o usuário cai ao clicar no email
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `Email de redefinição enviado com sucesso para ${email}.`
      });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Erro ao enviar email: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  // Opções de Role baseadas no usuário logado
  const getRoleOptions = () => {
    const options = [];
    
    if (userRole === 'master' || userRole === 'admin') {
        options.push({ value: 'operator', label: 'Operador da Mesa' });
        options.push({ value: 'supervisor', label: 'Chefe de Atendimento' });
        options.push({ value: 'admin', label: 'Supervisor do Sistema' });
    } else if (userRole === 'supervisor') {
        options.push({ value: 'operator', label: 'Operador da Mesa' });
    }
    
    return options;
  };

  const roleOptions = getRoleOptions();
  const isFormValid = formData.name.trim() !== '' && formData.matricula.trim() !== '' && formData.role;

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Tentando salvar usuário:", formData); // Log para debug

    if (!isFormValid) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // 1. Inserir na tabela Staff (Banco de Dados)
      const fakeEmail = `${formData.matricula.toLowerCase().trim()}@suse.sys`;
      const tempPassword = `temp${Math.floor(1000 + Math.random() * 9000)}`;

      // Inserção no banco
      const { error: dbError } = await supabase
        .from('staff')
        .insert([{
          full_name: formData.name, // Ajustado para full_name conforme banco atualizado
          matricula: formData.matricula,
          email: fakeEmail,
          role: formData.role,
          // must_change_password: true // Removido pois não existe no schema atual
        }]);

      if (dbError) throw dbError;

      setMessage({
        type: 'success',
        text: `Usuário cadastrado no banco com sucesso! \n\nIMPORTANTE: Crie o usuário no Supabase Auth com:\nEmail: ${fakeEmail}\nSenha: ${tempPassword}`
      });
      
      setFormData({ name: '', matricula: '', role: 'operator' });
      fetchUsers(); // Atualiza lista

    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Erro ao cadastrar: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Formulário de Cadastro */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 p-3 rounded-full">
              <UserPlus className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Cadastro de Usuários</h2>
          </div>

          {message.text && (
            <div className={`p-4 rounded-md mb-6 whitespace-pre-line ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Matrícula</label>
                <input
                  type="text"
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.matricula}
                  onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                />
                <p className="mt-1 text-xs text-gray-500">Será usada para login.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Perfil de Acesso</label>
                <select
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  {roleOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={loading || !isFormValid}
                className={`flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors
                    ${loading || !isFormValid ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} 
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Processando...' : 'Cadastrar Usuário'}
              </button>
            </div>
          </form>
        </div>

        {/* Lista de Usuários */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Usuários Cadastrados</h3>
            <button onClick={fetchUsers} className="text-gray-500 hover:text-gray-700">
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matrícula</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Perfil</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingList ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">Carregando...</td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">Nenhum usuário encontrado.</td>
                  </tr>
                ) : (
                  users.map((staff) => (
                    <tr key={staff.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{staff.full_name || staff.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.matricula}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${staff.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                            staff.role === 'supervisor' ? 'bg-blue-100 text-blue-800' : 
                            'bg-green-100 text-green-800'}`}>
                          {staff.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${staff.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {staff.status || 'active'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleResetPassword(staff.email)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                          title="Enviar email de redefinição de senha"
                        >
                          <KeyRound className="h-5 w-5" />
                        </button>
                        {/* Botão de Excluir (Opcional, futuro) */}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

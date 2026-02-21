import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { UserPlus, Save, AlertCircle } from 'lucide-react';

export default function UserManagement() {
  const { userRole } = useAuth(); // Obter role do contexto
  const [formData, setFormData] = useState({
    name: '',
    matricula: '',
    role: 'operator'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Opções de Role baseadas no usuário logado
  const getRoleOptions = () => {
    const options = [];
    
    if (userRole === 'master' || userRole === 'admin') {
        // Master/Admin pode criar tudo (ou quase tudo, Admin cria Chefe, Master cria Admin)
        // Simplificando: Master e Admin veem todos para facilitar teste
        options.push({ value: 'operator', label: 'Operador da Mesa' });
        options.push({ value: 'supervisor', label: 'Chefe de Atendimento' });
        options.push({ value: 'admin', label: 'Supervisor do Sistema' });
    } else if (userRole === 'supervisor') {
        // Chefe só cria Operador
        options.push({ value: 'operator', label: 'Operador da Mesa' });
    }
    
    return options;
  };

  const roleOptions = getRoleOptions();

  // Se não tiver permissão para ver nada (ex: operador acessou via URL), redirecionar ou mostrar erro
  // (Idealmente o PrivateRoute já barra, mas aqui reforçamos a UI)

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // 1. Inserir na tabela Staff (Banco de Dados)
      const fakeEmail = `${formData.matricula.toLowerCase().trim()}@suse.sys`;
      const tempPassword = `temp${Math.floor(1000 + Math.random() * 9000)}`; // Senha temporária aleatória ou fixa se preferir

      // Inserção no banco
      const { error: dbError } = await supabase
        .from('staff')
        .insert([{
          name: formData.name,
          matricula: formData.matricula,
          email: fakeEmail,
          role: formData.role,
          must_change_password: true // Obriga troca de senha
        }]);

      if (dbError) throw dbError;

      // 2. Feedback sobre o Auth (Como não temos backend, instruímos o Master)
      setMessage({
        type: 'success',
        text: `Usuário cadastrado no banco com sucesso! \n\nIMPORTANTE: Como este é um ambiente de demonstração, você precisa ir no painel do Supabase Auth e criar o usuário manualmente com:\nEmail: ${fakeEmail}\nSenha Temporária sugerida: ${tempPassword}`
      });
      
      setFormData({ name: '', matricula: '', role: 'operator' });

    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Erro ao cadastrar: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 p-3 rounded-full">
              <UserPlus className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Cadastro de Usuários (Restrito)</h2>
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
                disabled={loading}
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Cadastrando...' : 'Cadastrar Usuário'}
              </button>
            </div>
          </form>
          
          <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  O usuário cadastrado precisará trocar a senha no primeiro acesso.
                  <br />
                  Login: Matrícula + Senha Temporária.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

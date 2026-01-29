import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase'; // Importação corrigida
import { ShieldAlert } from 'lucide-react';

export default function Login() {
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      
      // Converter Matrícula para Email Interno
      const fakeEmail = `${matricula.toLowerCase().trim()}@suse.sys`;
      console.log("Tentando login com:", fakeEmail); // LOG DE DEBUG
      
      const { user, error: authError } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: password
      });

      if (authError) {
        console.error("Erro no Auth:", authError);
        throw authError;
      }

      console.log("Auth sucesso, User ID:", user?.user?.id);

      // Verificar perfil na tabela staff
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('*')
        .eq('id', user.user.id)
        .single();
      
      console.log("Dados do Staff:", staffData, "Erro Staff:", staffError);

      if (staffError || !staffData) {
          throw new Error("Usuário autenticado, mas sem perfil na tabela staff.");
      }

      // Verificar se o perfil selecionado bate com o do banco
      if (staffData.role !== role) {
          throw new Error(`Perfil incorreto. Seu cadastro é: ${staffData.role}`);
      }
      
      navigate('/admin/dashboard');

    } catch (err) {
      console.error("Erro Final:", err);
      setError(err.message || 'Falha no login: Verifique matrícula, senha e perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-red-100 p-3 rounded-full mb-2">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">SUSE-DF</h1>
          <p className="text-gray-500">Acesso Restrito - Atendimento</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Matrícula (Apenas Números)</label>
            <input
              type="text"
              name="matricula"
              id="matricula"
              autoComplete="username"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value)}
              placeholder="Ex: 000001"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha alfanumérica"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Perfil de Acesso</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
            >
              <option value="operator">Operador da Mesa de Atendimento</option>
              <option value="supervisor">Chefe de Atendimento</option>
              <option value="admin">Supervisor do Sistema</option>
              {/* O perfil Master é oculto ou acessado via 'admin' especial, ou podemos exibir se quiser */}
              <option value="master">Master (Gestão de Usuários)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Acessar Sistema' : 'Acessar'}
          </button>
        </form>
      </div>
    </div>
  );
}

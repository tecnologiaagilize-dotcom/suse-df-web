import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert } from 'lucide-react';

export default function Login() {
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect only if already logged in as staff
  // Allows switching accounts if logged in as driver/passenger
  useEffect(() => {
    if (user && !authLoading) {
       const isStaff = ['admin', 'operator', 'supervisor', 'master'].includes(userRole);
       if (isStaff) {
         navigate('/admin/dashboard');
       }
    }
  }, [user, userRole, authLoading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      
      // Converter Matrícula para Email Interno
      const fakeEmail = `${matricula.toLowerCase().trim()}@suse.sys`;
      
      console.log('Tentando login com:', fakeEmail); // Debug
      
      const { user, mustChangePassword } = await signIn(fakeEmail, password);
      
      // Verificar se o perfil selecionado bate com o do banco (opcional, mas boa prática de UX/Segurança)
      // Por enquanto, confiamos no login e redirecionamos
      
      if (mustChangePassword) {
        navigate('/admin/change-password');
      } else {
        navigate('/admin/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError('Falha no login: Verifique matrícula, senha e perfil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="text-red-600" />
            SUSE-DF
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sistema Unificado de Segurança e Emergência v1.3.1
          </p>
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

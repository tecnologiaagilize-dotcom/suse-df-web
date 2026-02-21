import { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { AlertCircle, User, Lock, Stethoscope, BadgeCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function ProfessionalLogin() {
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Capturar redirecionamento da URL
  const searchParams = new URLSearchParams(location.search);
  const redirectUrl = searchParams.get('redirect') || '/professional/dashboard';

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      
      // Simulação: Transforma Matrícula em Email para o Supabase Auth
      // O sistema assume que o cadastro foi feito com matricula@suse.pro
      const fakeEmail = `${matricula}@suse.pro`;

      const { user } = await signIn(fakeEmail, password);
      
      navigate(redirectUrl);
    } catch (error) {
      setError('Falha na autenticação. Verifique matrícula e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border-t-4 border-blue-600">
        <div className="text-center">
          <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Stethoscope className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">
            Acesso Profissional
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Identifique-se com sua matrícula funcional
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="relative">
              <BadgeCheck className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Matrícula Funcional (Ex: 123456)"
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Senha de Acesso"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Validando Credenciais...' : 'Acessar Sistema'}
            </button>
          </div>
        </form>
        
        <div className="text-center pt-4 border-t border-gray-100">
             <p className="text-xs text-gray-400">
                 Seu acesso é monitorado e auditado. Uso restrito a pessoal autorizado.
             </p>
        </div>
      </div>
    </div>
  );
}
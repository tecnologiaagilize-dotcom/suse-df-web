import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, User, Lock, Video } from 'lucide-react';
import FaceLogin from '../../components/face-auth/FaceLogin';

export default function DriverLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [useFaceLogin, setUseFaceLogin] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      console.log('Tentando login motorista com:', email); // Debug
      const { user } = await signIn(email, password);
      // Check if user is driver
      // For now, assume yes and redirect
      navigate('/driver/dashboard');
    } catch (error) {
      setError('Falha ao fazer login: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFaceVerified = (verified) => {
    if (verified) {
      // Logic to auto-login with face would go here
      // Typically requires a backend verification of the face descriptor
      alert('Face reconhecida! (Simulação)');
      navigate('/driver/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">SUSE-DF</h2>
          <p className="mt-2 text-sm text-gray-600">Acesso do Condutor</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {!useFaceLogin ? (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div className="relative">
                <User className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="relative">
                <Lock className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  required
                  className="appearance-none rounded-none relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-red-500 focus:border-red-500 focus:z-10 sm:text-sm"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => setUseFaceLogin(true)}
                className="flex items-center justify-center w-full text-sm text-gray-600 hover:text-gray-900"
              >
                <Video className="w-4 h-4 mr-2" />
                Entrar com Reconhecimento Facial
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <Link to="/driver/register" className="font-medium text-red-600 hover:text-red-500">
                Criar conta
              </Link>
              <Link to="/forgot-password" className="font-medium text-red-600 hover:text-red-500">
                Esqueci a senha
              </Link>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <FaceLogin onFaceVerified={handleFaceVerified} />
            <button
              onClick={() => setUseFaceLogin(false)}
              className="w-full text-center text-sm text-gray-600 hover:text-gray-900"
            >
              Voltar para login com senha
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

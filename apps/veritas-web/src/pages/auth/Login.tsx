import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md border border-gray-200">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-white mx-auto mb-4 font-bold text-xl">
            V
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Veritas Orbiun</h1>
          <p className="text-gray-500 mt-2">Acesse a plataforma de gestão ambiental</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              defaultValue="operador@veritas.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input 
              type="password" 
              defaultValue="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50"
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition-colors"
          >
            Entrar
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100">
          <button className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 transition-colors">
            <span>🦊</span>
            Conectar Carteira (Web3)
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, User, ShieldAlert } from 'lucide-react';

export default function RoleSelection() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-2xl border border-gray-100">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <ShieldAlert className="h-12 w-12 text-red-600" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">SUSE™</h1>
          <p className="mt-2 text-sm text-gray-500 font-medium uppercase tracking-widest">
            Sistema Unificado de Suporte e Emergência
          </p>
        </div>

        <div className="mt-10 space-y-4">
          <p className="text-center text-gray-600 font-medium mb-6">
            Como você deseja acessar o sistema hoje?
          </p>
          
          <button
            onClick={() => navigate('/driver/login')}
            className="w-full flex items-center p-5 border-2 border-gray-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-600 transition-colors">
              <Car className="h-8 w-8 text-blue-600 group-hover:text-white" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-lg font-bold text-gray-900">Sou Condutor</p>
              <p className="text-sm text-gray-500 font-medium">Motorista, Motoboy ou Ciclista</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/passenger/login')}
            className="w-full flex items-center p-5 border-2 border-gray-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-600 transition-colors">
              <User className="h-8 w-8 text-blue-600 group-hover:text-white" />
            </div>
            <div className="ml-4 text-left">
              <p className="text-lg font-bold text-gray-900">Sou Passageiro</p>
              <p className="text-sm text-gray-500 font-medium">Usuário em trânsito ou pedestre</p>
            </div>
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Versão 1.3.34 • Brasília-DF
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, User, Lock, Mail, Phone, FileText } from 'lucide-react';

export default function DriverRegister() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnh, setCnh] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      return setError('As senhas não coincidem');
    }

    try {
      setError('');
      setLoading(true);
      await signUp({
        email, 
        password, 
        name, 
        phone, 
        cpf,
        cnh,
        role: 'driver'
      });
      alert('Cadastro realizado! Prossiga para configurar sua voz.');
      // O login automático redireciona para o dashboard, mas queremos ir para voice-config
      // Como o signUp faz login, podemos redirecionar diretamente
      navigate('/driver/voice-config');
    } catch (error) {
      setError('Falha ao criar conta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Novo Condutor</h2>
          <p className="mt-2 text-sm text-gray-600">Preencha seus dados para cadastro</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-4" onSubmit={handleRegister}>
          <div className="rounded-md shadow-sm space-y-2">
            
            {/* Nome Completo */}
            <div className="relative">
              <User className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="Nome Completo"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Email */}
            <div className="relative">
              <Mail className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="email"
                required
                className="appearance-none rounded-md relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {/* Telefone */}
            <div className="relative">
              <Phone className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="tel"
                required
                className="appearance-none rounded-md relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="Telefone (WhatsApp)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {/* CPF */}
            <div className="relative">
              <FileText className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="CPF"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
              />
            </div>

            {/* CNH */}
            <div className="relative">
              <FileText className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                required
                className="appearance-none rounded-md relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="CNH"
                value={cnh}
                onChange={(e) => setCnh(e.target.value)}
              />
            </div>

            {/* Senha */}
            <div className="relative">
              <Lock className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                required
                className="appearance-none rounded-md relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Confirmar Senha */}
            <div className="relative">
              <Lock className="absolute top-3 left-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                required
                className="appearance-none rounded-md relative block w-full px-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm"
                placeholder="Confirmar Senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading ? 'Criando conta...' : 'Cadastrar'}
            </button>
          </div>

          <div className="text-center">
            <Link to="/driver/login" className="font-medium text-red-600 hover:text-red-500 text-sm">
              Já tem uma conta? Faça login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

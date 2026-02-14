import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Shield, User, HeartPulse, Stethoscope, ArrowRight } from 'lucide-react';
import HealthCheck from './HealthCheck';

export default function HealthAccessGuard() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [decisionMade, setDecisionMade] = useState(false);
  const [isProfessional, setIsProfessional] = useState(false);

  // Se já tiver decidido que é acesso público, renderiza o componente público diretamente
  if (decisionMade && !isProfessional) {
      return <HealthCheck />;
  }

  const handleProfessionalAccess = () => {
      // Redireciona para login profissional, passando o token como parâmetro para retorno
      // A rota de login deve lidar com o redirecionamento pós-login para o Prontuário Completo
      navigate(`/professional/login?redirect=/professional/patient/${token}`);
  };

  const handlePublicAccess = () => {
      setDecisionMade(true);
      setIsProfessional(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-blue-600 p-6 text-center">
                <Shield className="w-16 h-16 text-white mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-white">Verificação de Acesso</h1>
                <p className="text-blue-100 text-sm mt-2">
                    Sistema Unificado de Socorro e Emergência
                </p>
            </div>

            <div className="p-8">
                <h2 className="text-center text-gray-800 font-bold text-lg mb-6">
                    Você é um profissional de Saúde ou Segurança?
                </h2>

                <div className="space-y-4">
                    {/* Botão SIM (Profissional) */}
                    <button 
                        onClick={handleProfessionalAccess}
                        className="w-full group relative flex items-center justify-between p-4 bg-blue-50 border-2 border-blue-100 rounded-xl hover:border-blue-500 hover:bg-blue-100 transition-all duration-200"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-500 p-2 rounded-lg text-white group-hover:scale-110 transition-transform">
                                <Stethoscope size={24} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold text-blue-900">Sim, sou Profissional</span>
                                <span className="text-xs text-blue-600">Acesso via Matrícula</span>
                            </div>
                        </div>
                        <ArrowRight className="text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                    </button>

                    {/* Botão NÃO (Público/Emergência) */}
                    <button 
                        onClick={handlePublicAccess}
                        className="w-full group relative flex items-center justify-between p-4 bg-red-50 border-2 border-red-100 rounded-xl hover:border-red-500 hover:bg-red-100 transition-all duration-200"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-red-500 p-2 rounded-lg text-white group-hover:scale-110 transition-transform">
                                <HeartPulse size={24} />
                            </div>
                            <div className="text-left">
                                <span className="block font-bold text-red-900">Não / Socorrista Civil</span>
                                <span className="text-xs text-red-600">Acesso Dados de Emergência</span>
                            </div>
                        </div>
                        <ArrowRight className="text-red-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all" />
                    </button>
                </div>

                <div className="mt-8 text-center border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-400">
                        O acesso indevido a dados médicos é monitorado e sujeito a penalidades legais.
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
}
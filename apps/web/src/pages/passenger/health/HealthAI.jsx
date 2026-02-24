import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Sparkles, Activity, AlertTriangle, Lightbulb, Brain, Stethoscope, RefreshCw } from 'lucide-react';

export default function HealthAI({ profileId }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Simulação de Dados de IA (enquanto não conectamos uma Edge Function real)
  const generateMockAnalysis = async () => {
    setLoading(true);
    
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Busca dados reais para "contextualizar" o mock
    const { data: allergies } = await supabase.from('allergies').select('allergen').eq('profile_id', profileId);
    const { data: meds } = await supabase.from('medications').select('name').eq('profile_id', profileId);
    
    const allergyText = allergies?.map(a => a.allergen).join(', ') || 'nenhuma alergia registrada';
    const medText = meds?.map(m => m.name).join(', ') || 'nenhum medicamento contínuo';

    const mockResult = {
        summary: `Perfil de saúde estável. O usuário possui ${allergies?.length || 0} alergias conhecidas e utiliza ${meds?.length || 0} medicamentos. Recomenda-se atenção especial a interações medicamentosas caso novos tratamentos sejam iniciados.`,
        risk_factors: [
            { level: 'low', text: 'Risco de interação medicamentosa baixo com o quadro atual.' },
            { level: 'medium', text: 'Histórico de alergias requer atenção em prontos-socorros.' },
            { level: 'low', text: 'Dados vitais não monitorados recentemente.' }
        ],
        recommendations: [
            'Manter carteira de vacinação digital atualizada.',
            'Realizar check-up cardiológico anual (preventivo).',
            'Atualizar contatos de emergência a cada 6 meses.'
        ],
        generated_at: new Date().toISOString()
    };

    setAnalysis(mockResult);
    setLastUpdated(new Date());
    setLoading(false);
  };

  if (!profileId) return null;

  return (
    <div className="space-y-6 pb-12">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-xl text-white shadow-lg">
            <div className="flex items-center gap-3 mb-4">
                <Brain className="w-8 h-8 text-purple-200" />
                <h2 className="text-xl font-bold">Assistente de Saúde IA</h2>
            </div>
            <p className="text-purple-100 text-sm mb-6">
                Nossa inteligência artificial analisa seus dados médicos, alergias e medicamentos para fornecer insights preventivos e alertas de risco.
            </p>
            
            <button 
                onClick={generateMockAnalysis}
                disabled={loading}
                className="w-full bg-white text-purple-700 py-3 rounded-lg font-bold hover:bg-purple-50 transition flex items-center justify-center gap-2 shadow-md"
            >
                {loading ? (
                    <>
                        <RefreshCw className="w-5 h-5 animate-spin" /> Analisando Dados...
                    </>
                ) : (
                    <>
                        <Sparkles className="w-5 h-5" /> Gerar Nova Análise
                    </>
                )}
            </button>
        </div>

        {analysis && (
            <div className="space-y-4 animate-fade-in">
                {/* Resumo */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                        <Activity className="text-blue-500" size={20} /> Resumo Clínico
                    </h3>
                    <p className="text-gray-600 leading-relaxed text-sm">
                        {analysis.summary}
                    </p>
                </div>

                {/* Fatores de Risco */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                        <AlertTriangle className="text-orange-500" size={20} /> Fatores de Risco Identificados
                    </h3>
                    <div className="space-y-2">
                        {analysis.risk_factors.map((risk, idx) => (
                            <div key={idx} className={`flex items-start gap-3 p-3 rounded-md ${
                                risk.level === 'high' ? 'bg-red-50 text-red-800' : 
                                risk.level === 'medium' ? 'bg-orange-50 text-orange-800' : 'bg-green-50 text-green-800'
                            }`}>
                                <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${
                                    risk.level === 'high' ? 'bg-red-500' : 
                                    risk.level === 'medium' ? 'bg-orange-500' : 'bg-green-500'
                                }`} />
                                <p className="text-sm font-medium">{risk.text}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recomendações */}
                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                        <Lightbulb className="text-yellow-500" size={20} /> Recomendações Preventivas
                    </h3>
                    <ul className="space-y-3">
                        {analysis.recommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                                <Stethoscope className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                {rec}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="text-center pt-4">
                    <p className="text-xs text-gray-400">
                        Análise gerada em: {new Date(analysis.generated_at).toLocaleString()} <br/>
                        Aviso: Esta é uma análise automatizada e não substitui o diagnóstico médico profissional.
                    </p>
                </div>
            </div>
        )}
    </div>
  );
}
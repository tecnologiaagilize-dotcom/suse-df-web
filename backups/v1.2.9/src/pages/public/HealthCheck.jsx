import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { HeartPulse, AlertTriangle, Phone, FileText, User, ShieldAlert, ArrowLeft } from 'lucide-react';

export default function HealthCheck() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchHealthData = async () => {
      // 1. Validação básica de UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!token || !uuidRegex.test(token)) {
        setError(`Token inválido (Formato incorreto): ${token}`);
        setLoading(false);
        return;
      }

      try {
        console.log("HealthCheck: Buscando dados para token:", token);
        
        const { data: result, error: rpcError } = await supabase.rpc('get_public_health_info', { 
            p_token: token 
        });

        if (rpcError) {
             console.error("HealthCheck: Erro RPC Completo:", rpcError);
             // Exibe a mensagem técnica real para debug
             throw new Error(`Erro RPC: ${rpcError.message} (Cód: ${rpcError.code || 'N/A'})`);
        }

        if (!result || result.success === false) {
             const msg = result?.error || 'Token não encontrado no banco.';
             console.warn("HealthCheck: Falha lógica:", msg);
             throw new Error(msg);
        }

        setData(result);
      } catch (err) {
        console.error("HealthCheck: Catch Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHealthData();
  }, [token]);

  if (loading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-100">
              <div className="animate-pulse flex flex-col items-center">
                  <HeartPulse className="w-12 h-12 text-red-600 mb-4 animate-bounce" />
                  <p className="text-gray-500 font-medium">Validando QR Code...</p>
              </div>
          </div>
      );
  }

  if (error) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
              <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center border-l-4 border-red-600">
                  <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                  <h1 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h1>
                  <p className="text-gray-600 mb-6">{error}</p>
                  <button 
                    onClick={() => navigate('/')}
                    className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition"
                  >
                    Voltar ao Início
                  </button>
              </div>
          </div>
      );
  }

  const { personal, health, allergies, medications, emergency_contacts } = data;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header de Emergência */}
      <header className="bg-red-600 text-white p-4 shadow-md sticky top-0 z-20">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <HeartPulse className="w-8 h-8" />
                  <div>
                      <h1 className="text-lg font-bold leading-tight">Ficha Médica de Emergência</h1>
                      <p className="text-xs text-red-100">SUSE-DF | Acesso Público Autorizado</p>
                  </div>
              </div>
              <div className="text-right hidden sm:block">
                  <p className="text-xs font-mono bg-red-700 px-2 py-1 rounded">
                      Gerado: {new Date(data.generated_at).toLocaleTimeString()}
                  </p>
              </div>
          </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
          
          {/* Identificação Vital */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center gap-2">
                  <User className="text-blue-600" size={20} />
                  <h2 className="font-bold text-gray-800">Identificação</h2>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                      <span className="text-xs text-gray-500 uppercase">Nome Completo</span>
                      <p className="text-xl font-bold text-gray-900">{personal.full_name}</p>
                  </div>
                  <div>
                      <span className="text-xs text-gray-500 uppercase">Nascimento</span>
                      <p className="font-medium text-gray-900">
                          {personal.birth_date ? new Date(personal.birth_date).toLocaleDateString() : 'Não inf.'}
                      </p>
                  </div>
                  <div>
                      <span className="text-xs text-gray-500 uppercase">Tipo Sanguíneo</span>
                      <p className="text-2xl font-black text-red-600">{personal.blood_type || '?'}</p>
                  </div>
              </div>
          </section>

          {/* Alertas Críticos */}
          <section className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
              <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-2">
                  <ShieldAlert className="text-red-600" size={20} />
                  <h2 className="font-bold text-red-800">Alertas Médicos</h2>
              </div>
              <div className="p-4 space-y-4">
                  <div>
                      <span className="text-xs text-gray-500 uppercase block mb-1">Alergias</span>
                      {allergies && allergies.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                              {allergies.map((a, i) => (
                                  <span key={i} className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold border border-red-200">
                                      {a.allergen}
                                  </span>
                              ))}
                          </div>
                      ) : (
                          <p className="text-gray-400 italic">Nenhuma alergia registrada.</p>
                      )}
                  </div>
                  
                  <div className="pt-3 border-t border-gray-100">
                       <span className="text-xs text-gray-500 uppercase block mb-1">Medicamentos em Uso</span>
                       {medications && medications.length > 0 ? (
                          <ul className="list-disc pl-5 space-y-1">
                              {medications.map((m, i) => (
                                  <li key={i} className="text-gray-800 font-medium">
                                      {m.name} <span className="text-gray-500 text-sm">({m.dosage})</span>
                                  </li>
                              ))}
                          </ul>
                       ) : (
                          <p className="text-gray-400 italic">Nenhum medicamento registrado.</p>
                       )}
                  </div>

                  {health.organ_donor && (
                      <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                          <HeartPulse className="text-pink-500" size={16} />
                          <span className="font-bold text-gray-800">Doador de Órgãos</span>
                      </div>
                  )}
              </div>
          </section>

          {/* Dados Adicionais */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center gap-2">
                  <FileText className="text-gray-600" size={20} />
                  <h2 className="font-bold text-gray-800">Informações Complementares</h2>
              </div>
              <div className="p-4 space-y-3">
                  {health.sus_card && (
                      <div>
                          <span className="text-xs text-gray-500 uppercase">Cartão SUS</span>
                          <p className="font-mono font-medium text-gray-900 tracking-wider">{health.sus_card}</p>
                      </div>
                  )}
                  {health.health_insurance?.nome && (
                      <div>
                          <span className="text-xs text-gray-500 uppercase">Plano de Saúde</span>
                          <p className="font-medium text-gray-900">{health.health_insurance.nome}</p>
                      </div>
                  )}
                  {health.additional_notes && (
                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 mt-2">
                          <span className="text-xs text-yellow-800 uppercase font-bold block mb-1">Notas / Observações</span>
                          <p className="text-sm text-gray-800 italic">"{health.additional_notes}"</p>
                      </div>
                  )}
              </div>
          </section>

          {/* Contatos de Emergência */}
          {emergency_contacts && emergency_contacts.length > 0 && (
              <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center gap-2">
                      <Phone className="text-green-600" size={20} />
                      <h2 className="font-bold text-gray-800">Contatos de Emergência</h2>
                  </div>
                  <div className="divide-y divide-gray-100">
                      {emergency_contacts.map((contact, i) => (
                          <div key={i} className="p-4 flex justify-between items-center">
                              <div>
                                  <p className="font-bold text-gray-900">{contact.name}</p>
                                  <p className="text-xs text-gray-500 uppercase bg-gray-100 px-2 py-0.5 rounded-full w-fit mt-1">{contact.relationship}</p>
                              </div>
                              <a 
                                href={`tel:${contact.phone}`}
                                className="bg-green-100 text-green-700 p-3 rounded-full hover:bg-green-200 transition"
                              >
                                  <Phone size={20} />
                              </a>
                          </div>
                      ))}
                  </div>
              </section>
          )}

          <div className="text-center pt-8 pb-4">
              <p className="text-xs text-gray-400">
                  Sistema Unificado de Socorro e Emergência - DF<br/>
                  Dados fornecidos pelo usuário. Verifique documentos oficiais.
              </p>
          </div>
      </main>
    </div>
  );
}
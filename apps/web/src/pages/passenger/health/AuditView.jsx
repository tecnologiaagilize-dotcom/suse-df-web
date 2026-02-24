import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Eye, Clock, Shield, User } from 'lucide-react';

export default function AuditView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Buscar logs onde o usuário é o ALVO (target_profile_id)
        // Requer que o Módulo 5 (Audit) esteja instalado no banco
        const { data, error } = await supabase
            .from('health_audit_logs')
            .select(`
                *,
                actor:actor_id (
                    email
                )
            `)
            .eq('target_profile_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            // Se a tabela não existir ou erro de permissão, falha silenciosa ou mock
            console.warn("Erro ao buscar logs:", error);
        } else {
            setLogs(data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-6">
        <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-gray-500" /> Histórico de Acessos
        </h3>

        {loading ? (
            <p className="text-center text-gray-400 text-sm">Carregando...</p>
        ) : logs.length === 0 ? (
            <div className="text-center py-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Nenhum acesso registrado recentemente.</p>
            </div>
        ) : (
            <div className="space-y-3">
                {logs.map(log => (
                    <div key={log.id} className="flex justify-between items-start text-sm border-b border-gray-100 pb-2 last:border-0">
                        <div>
                            <p className="font-medium text-gray-800">
                                {log.action_type === 'VIEW' ? 'Visualização de Dados' : log.action_type}
                            </p>
                            <p className="text-xs text-gray-500">
                                Por: {log.actor?.email || 'Sistema/Anônimo'}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center gap-1 text-gray-400 text-xs">
                                <Clock size={12} />
                                {new Date(log.created_at).toLocaleDateString()}
                            </div>
                            <span className="text-xs text-gray-400">
                                {new Date(log.created_at).toLocaleTimeString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        )}
        
        <div className="mt-4 pt-2 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
                Este registro mostra quem acessou sua ficha médica através do QR Code ou Sistema.
            </p>
        </div>
    </div>
  );
}
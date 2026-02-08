import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Shield, Search, RefreshCw, FileText, Download, ArrowLeft, BarChart2, CheckCircle, AlertTriangle } from 'lucide-react';

const ROLE_LABELS = {
    master: 'Master',
    admin: 'Supervisor do Sistema',
    supervisor: 'Chefe de Atendimento',
    operator: 'Operador da Mesa',
    driver: 'Condutor'
};

export default function AuditLogs() {
  const { userRole } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  
  // Stats
  const [stats, setStats] = useState({
      totalEvents: 0,
      resolvedCount: 0,
      acceptedCount: 0
  });
  
  useEffect(() => {
    // Segurança extra no Frontend
    if (userRole !== 'admin' && userRole !== 'master' && userRole !== 'supervisor') {
        alert('Acesso restrito.');
        navigate('/admin/dashboard');
        return;
    }
    fetchLogs();
  }, [userRole]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // Chamada RPC
      let query = supabase.rpc('get_audit_logs', { p_limit: 200, p_offset: 0 }); // Aumentei limit para pegar mais dados para stats
      
      if (filterAction) {
          query = supabase.rpc('get_audit_logs', { p_limit: 200, p_offset: 0, p_action: filterAction });
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const logData = data || [];
      setLogs(logData);

      // Calcular Stats básicos do lote atual
      setStats({
          totalEvents: logData.length,
          resolvedCount: logData.filter(l => l.action.includes('RESOLVE')).length,
          acceptedCount: logData.filter(l => l.action.includes('ACCEPT')).length
      });

    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
      // Exportação simples para CSV
      const headers = ['Data', 'Ação', 'Usuário', 'Cargo', 'ID Alvo', 'Detalhes'];
      const csvContent = [
          headers.join(','),
          ...logs.map(log => [
              new Date(log.created_at).toLocaleString(),
              log.action,
              log.actor_email || 'Sistema/Anônimo',
              log.actor_role || '-',
              log.target_id || '-',
              JSON.stringify(log.metadata).replace(/,/g, ';') // Escape simples
          ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `auditoria_suse_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
              <button onClick={() => navigate('/admin/dashboard')} className="text-gray-500 hover:text-gray-900">
                  <ArrowLeft size={24} />
              </button>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="text-blue-900" />
                Auditoria e Governança
              </h1>
          </div>
          <div className="flex items-center gap-2">
              <button onClick={fetchLogs} className="p-2 text-gray-500 hover:text-blue-600" title="Atualizar">
                  <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
              <button onClick={handleExport} className="flex items-center gap-2 bg-blue-900 text-white px-4 py-2 rounded hover:bg-blue-800 transition-colors">
                  <Download size={18} /> Exportar CSV
              </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-900">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-sm font-medium text-gray-600">Total de Eventos (Recentes)</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-full">
                          <BarChart2 className="text-blue-900 h-6 w-6" />
                      </div>
                  </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-sm font-medium text-gray-600">Ocorrências Assumidas</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.acceptedCount}</p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-full">
                          <AlertTriangle className="text-yellow-600 h-6 w-6" />
                      </div>
                  </div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                  <div className="flex items-center justify-between">
                      <div>
                          <p className="text-sm font-medium text-gray-600">Ocorrências Finalizadas</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.resolvedCount}</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-full">
                          <CheckCircle className="text-green-600 h-6 w-6" />
                      </div>
                  </div>
              </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex gap-4 bg-gray-50">
                  <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Filtrar por tipo de ação (ex: ALERT_RESOLVE)..." 
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                      />
                  </div>
                  <button onClick={fetchLogs} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                      Filtrar
                  </button>
              </div>

              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data/Hora</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ator</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalhes</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {loading ? (
                              <tr>
                                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                                      Carregando registros de auditoria...
                                  </td>
                              </tr>
                          ) : logs.length === 0 ? (
                              <tr>
                                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                                      Nenhum registro encontrado.
                                  </td>
                              </tr>
                          ) : (
                              logs.map((log) => (
                                  <tr key={log.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                          {new Date(log.created_at).toLocaleString()}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${log.action.includes('RESOLVE') ? 'bg-green-100 text-green-800' : 
                                              log.action.includes('ALERT') ? 'bg-yellow-100 text-yellow-800' : 
                                              'bg-gray-100 text-gray-800'}`}>
                                              {log.action}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                          <div className="font-medium">{log.actor_email || 'Sistema'}</div>
                                          <div className="text-xs text-gray-500">{ROLE_LABELS[log.actor_role] || log.actor_role}</div>
                                      </td>
                                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                          <details className="cursor-pointer">
                                              <summary className="hover:text-blue-600 flex items-center gap-1">
                                                  <FileText size={14} /> Ver Metadados
                                              </summary>
                                              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
                                                  {JSON.stringify(log.metadata, null, 2)}
                                              </pre>
                                          </details>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      </main>
    </div>
  );
}

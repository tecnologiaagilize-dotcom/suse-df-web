import React from 'react';
import { PageHeader } from '../../components/PageHeader';
import { Plus, Search, Filter } from 'lucide-react';

export const LotesList = () => {
  return (
    <div>
      <PageHeader 
        title="Gestão de Lotes" 
        description="Gerencie e rastreie os lotes de resíduos desde a coleta até o processamento."
      >
        <button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="h-4 w-4" />
          Novo Lote
        </button>
      </PageHeader>

      <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por ID, tipo ou local..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/20"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-900">
            <Filter className="h-4 w-4" />
            Filtros
          </button>
        </div>

        {/* Table Placeholder */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 font-medium">ID do Lote</th>
                <th className="px-6 py-3 font-medium">Tipo de Resíduo</th>
                <th className="px-6 py-3 font-medium">Quantidade</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Data Coleta</th>
                <th className="px-6 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              <tr className="bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">#BATCH-2026-001</td>
                <td className="px-6 py-4">Vidro</td>
                <td className="px-6 py-4">1,200 kg</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                    Processado
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">27/01/2026</td>
                <td className="px-6 py-4 text-right">
                  <button className="text-green-600 hover:text-green-700 font-medium">Ver Detalhes</button>
                </td>
              </tr>
              {/* More rows... */}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

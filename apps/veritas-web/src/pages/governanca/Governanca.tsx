import React from 'react';
import { PageHeader } from '../../components/PageHeader';

export const Governanca = () => {
  return (
    <div>
      <PageHeader 
        title="Governança & Compliance" 
        description="Verificação de licenças e auditoria de processos."
      />
       <div className="bg-white dark:bg-gray-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
        <h3 className="font-bold text-lg mb-4">Status de Licenciamento</h3>
        <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="h-10 w-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center text-green-600 dark:text-green-300">
            ✓
          </div>
          <div>
            <p className="font-medium text-green-900 dark:text-green-300">Licença Operacional Ativa</p>
            <p className="text-sm text-green-700 dark:text-green-400">Válida até 31/12/2026 - Emitida por CETESB</p>
          </div>
        </div>
      </div>
    </div>
  );
};

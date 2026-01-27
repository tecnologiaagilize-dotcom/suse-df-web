import React from 'react';
import { PageHeader } from '../../components/PageHeader';

export const Relatorios = () => {
  return (
    <div>
      <PageHeader 
        title="Relatórios ESG" 
        description="Geração de relatórios de impacto e certificados."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="font-bold text-lg mb-2">Relatório de Impacto Mensal</h3>
          <p className="text-gray-500 text-sm mb-4">Resumo detalhado de todo carbono evitado e lotes processados no último mês.</p>
          <button className="text-green-600 font-medium text-sm hover:underline">Baixar PDF</button>
        </div>
        <div className="bg-white dark:bg-gray-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h3 className="font-bold text-lg mb-2">Certificado de Conformidade</h3>
          <p className="text-gray-500 text-sm mb-4">Documento oficial para fins de auditoria e compliance regulatório.</p>
          <button className="text-green-600 font-medium text-sm hover:underline">Baixar PDF</button>
        </div>
      </div>
    </div>
  );
};

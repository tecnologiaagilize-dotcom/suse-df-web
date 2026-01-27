import React from 'react';
import { PageHeader } from '../../components/PageHeader';

export const Burn = () => {
  return (
    <div>
      <PageHeader 
        title="Burn / Aposentadoria" 
        description="Aposente tokens para compensação de carbono e emissão de certificados."
      />
      <div className="bg-white dark:bg-gray-950 p-12 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">🔥</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Aposentadoria de Tokens</h3>
        <p className="text-gray-500 mt-2 max-w-md">
          Selecione tokens da sua carteira para queimar e gerar o certificado de compensação definitivo.
        </p>
        <button className="mt-6 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
          Selecionar Tokens para Burn
        </button>
      </div>
    </div>
  );
};

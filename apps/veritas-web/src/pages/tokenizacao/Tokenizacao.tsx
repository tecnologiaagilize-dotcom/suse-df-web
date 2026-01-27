import React from 'react';
import { PageHeader } from '../../components/PageHeader';

export const Tokenizacao = () => {
  return (
    <div>
      <PageHeader 
        title="Tokenização" 
        description="Converta lotes processados em ativos digitais (VL e OI)."
      />
      <div className="bg-white dark:bg-gray-950 p-12 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">🪙</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Área de Tokenização</h3>
        <p className="text-gray-500 mt-2 max-w-md">
          Selecione um lote processado para iniciar o processo de emissão de tokens ERC-1155.
        </p>
        <button className="mt-6 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
          Iniciar Tokenização
        </button>
      </div>
    </div>
  );
};

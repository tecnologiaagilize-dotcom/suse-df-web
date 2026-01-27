import React from 'react';
import { PageHeader } from '../../components/PageHeader';

export const Marketplace = () => {
  return (
    <div>
      <PageHeader 
        title="Marketplace" 
        description="Compre e venda tokens de impacto ambiental (Orbiun Impact)."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-40 bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
              <span className="text-4xl">🌱</span>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-800 rounded-full">Vidro Reciclado</span>
                <span className="text-sm text-gray-500">#OI-{1000+i}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">100 kg CO2e Evitado</h3>
              <p className="text-sm text-gray-500 mb-4">Originado de processamento em São Paulo, SP.</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-xs text-gray-500">Preço</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">50 MATIC</p>
                </div>
                <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  Comprar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

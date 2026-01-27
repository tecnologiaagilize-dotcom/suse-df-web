import React from 'react';
import { PageHeader } from '../../components/PageHeader';
import { BarChart3, TrendingUp, Leaf, Wallet } from 'lucide-react';

const StatCard = ({ title, value, change, icon: Icon, trend }: any) => (
  <div className="bg-white dark:bg-gray-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</h3>
      </div>
      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <Icon className="h-5 w-5 text-green-600 dark:text-green-400" />
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm">
      <span className={trend === 'up' ? 'text-green-600' : 'text-red-600'}>
        {change}
      </span>
      <span className="text-gray-500 ml-2">vs. mês anterior</span>
    </div>
  </div>
);

export const Dashboard = () => {
  return (
    <div>
      <PageHeader 
        title="Dashboard Principal" 
        description="Visão geral dos indicadores de impacto e operações."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Carbono Evitado" 
          value="1,240 tCO2e" 
          change="+12.5%" 
          icon={Leaf} 
          trend="up"
        />
        <StatCard 
          title="Lotes Processados" 
          value="856" 
          change="+5.2%" 
          icon={BarChart3} 
          trend="up"
        />
        <StatCard 
          title="Tokens VL Emitidos" 
          value="856" 
          change="+5.2%" 
          icon={TrendingUp} 
          trend="up"
        />
        <StatCard 
          title="Saldo em Carteira" 
          value="450 OI" 
          change="-2.1%" 
          icon={Wallet} 
          trend="down"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm h-80 flex items-center justify-center text-gray-400">
          Gráfico de Impacto Ambiental (Placeholder)
        </div>
        <div className="bg-white dark:bg-gray-950 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm h-80 flex items-center justify-center text-gray-400">
          Atividades Recentes (Placeholder)
        </div>
      </div>
    </div>
  );
};

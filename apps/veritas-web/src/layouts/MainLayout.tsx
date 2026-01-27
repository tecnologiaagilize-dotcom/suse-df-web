import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Coins, 
  ShoppingCart, 
  Flame, 
  ShieldCheck, 
  FileText,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import { cn } from '../lib/utils';

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  to, 
  isActive 
}: { 
  icon: React.ElementType, 
  label: string, 
  to: string, 
  isActive: boolean 
}) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
        isActive 
          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" 
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );
};

export const MainLayout = () => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: Package, label: 'Gestão de Lotes', to: '/lotes' },
    { icon: Coins, label: 'Tokenização', to: '/tokenizacao' },
    { icon: ShoppingCart, label: 'Marketplace', to: '/marketplace' },
    { icon: Flame, label: 'Burn / Aposentadoria', to: '/burn' },
    { icon: ShieldCheck, label: 'Governança', to: '/governanca' },
    { icon: FileText, label: 'Relatórios', to: '/relatorios' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 font-bold text-xl text-green-600">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white">
              V
            </div>
            Veritas Orbiun
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="ml-auto lg:hidden text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-1">
          {navItems.map((item) => (
            <SidebarItem
              key={item.to}
              icon={item.icon}
              label={item.label}
              to={item.to}
              isActive={location.pathname.startsWith(item.to)}
            />
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-800">
          <button className="flex items-center gap-3 px-3 py-2 w-full text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-md transition-colors">
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-8">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-4 ml-auto">
            <div className="text-sm text-right hidden sm:block">
              <p className="font-medium text-gray-900 dark:text-gray-100">Usuário Demo</p>
              <p className="text-xs text-gray-500">Operador</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold border border-green-200">
              UD
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

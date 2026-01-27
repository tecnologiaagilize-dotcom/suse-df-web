import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/auth/Login';
import { Dashboard } from './pages/dashboard/Dashboard';
import { LotesList } from './pages/lotes/LotesList';
import { Tokenizacao } from './pages/tokenizacao/Tokenizacao';
import { Marketplace } from './pages/marketplace/Marketplace';
import { Burn } from './pages/burn/Burn';
import { Governanca } from './pages/governanca/Governanca';
import { Relatorios } from './pages/relatorios/Relatorios';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="lotes" element={<LotesList />} />
          <Route path="tokenizacao" element={<Tokenizacao />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="burn" element={<Burn />} />
          <Route path="governanca" element={<Governanca />} />
          <Route path="relatorios" element={<Relatorios />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

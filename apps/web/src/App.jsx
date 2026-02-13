import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Driver Pages
import DriverLogin from './pages/driver/Login';
import DriverRegister from './pages/driver/Register';
import DriverDashboard from './pages/driver/Dashboard';
import ForgotPassword from './pages/driver/ForgotPassword';
import VoiceConfig from './pages/driver/VoiceConfig';
import DriverProfile from './pages/driver/Profile';

// Passenger Pages
import PassengerLogin from './pages/passenger/Login';
import PassengerRegister from './pages/passenger/Register';
import PassengerDashboard from './pages/passenger/Dashboard';
import PassengerProfile from './pages/passenger/Profile';
import PassengerVoiceConfig from './pages/passenger/VoiceConfig';

import AdminDashboardReal from './pages/AdminDashboard';

import AdminLoginReal from './pages/Login';
import ChangePassword from './pages/admin/ChangePassword';
import UserManagement from './pages/admin/UserManagement';
import AuditLogs from './pages/admin/AuditLogs'; // Import added
import SharedAlert from './pages/public/SharedAlert';
import HealthCheck from './pages/HealthCheck';

// Protected Route Component
const PrivateRoute = ({ children, role }) => {
  const { user, userRole, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  
  if (!user) return <Navigate to="/driver/login" replace />;
  
  // Adicionando 'master' como role permitida para acesso total
  if (role && userRole !== role && userRole !== 'admin' && userRole !== 'master') {
     // Se o papel do usuário não corresponder ao exigido e não for admin/master
     
     // Definição de Staff (Equipe de Gestão)
     const isStaff = ['admin', 'operator', 'supervisor', 'master'].includes(userRole);
     const requiredAdminAccess = ['admin', 'operator', 'supervisor', 'master'].includes(role);
     
     // Se for staff acessando rota de staff, permite
     if (isStaff && requiredAdminAccess) {
         // Permite acesso
     } else {
        console.warn(`Acesso negado. Requer: ${role}, Usuário é: ${userRole}`);
        
        // Redireciona para o dashboard correto
        if (isStaff) {
            // Evita loop infinito: Se já está tentando ir para o admin, não redireciona de volta
            return <Navigate to="/admin/dashboard" replace />;
        } else if (userRole === 'passenger') {
            return <Navigate to="/passenger/dashboard" replace />;
        } else {
            return <Navigate to="/driver/dashboard" replace />;
        }
     }
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/driver/login" element={<DriverLogin />} />
          <Route path="/driver/register" element={<DriverRegister />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/tracking/:token" element={<SharedAlert />} />
          <Route path="/health" element={<HealthCheck />} />
          
          <Route path="/admin/login" element={<AdminLoginReal />} />
          
          <Route path="/admin/change-password" element={
             // Rota semi-protegida: requer login, mas não verifica role especificamente além de ser staff
             <PrivateRoute>
               <ChangePassword />
             </PrivateRoute>
          } />

          <Route path="/admin/users" element={
            <PrivateRoute role="admin">
              <UserManagement />
            </PrivateRoute>
          } />

          <Route path="/admin/audit" element={
            <PrivateRoute role="admin">
              <AuditLogs />
            </PrivateRoute>
          } />

          {/* Protected Driver Routes */}
          <Route path="/driver/dashboard" element={
            <PrivateRoute role="driver">
              <DriverDashboard />
            </PrivateRoute>
          } />
          
          <Route path="/driver/voice-config" element={
            <PrivateRoute role="driver">
              <VoiceConfig />
            </PrivateRoute>
          } />
          
          <Route path="/driver/profile" element={
            <PrivateRoute role="driver">
              <DriverProfile />
            </PrivateRoute>
          } />

          {/* Protected Passenger Routes */}
          <Route path="/passenger/login" element={<PassengerLogin />} />
          <Route path="/passenger/register" element={<PassengerRegister />} />
          
          <Route path="/passenger/dashboard" element={
            <PrivateRoute role="passenger">
              <PassengerDashboard />
            </PrivateRoute>
          } />

          <Route path="/passenger/voice-config" element={
            <PrivateRoute role="passenger">
              <PassengerVoiceConfig />
            </PrivateRoute>
          } />

          <Route path="/passenger/profile" element={
            <PrivateRoute role="passenger">
              <PassengerProfile />
            </PrivateRoute>
          } />

          {/* Protected Admin Routes */}
          {/* MUDANÇA: Agora aceita 'operator' como base, permitindo admins e supervisores também */}
          <Route path="/admin/dashboard" element={
            <PrivateRoute role="operator">
              <AdminDashboardReal />
            </PrivateRoute>
          } />
          
          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/driver/login" replace />} />
          <Route path="*" element={<Navigate to="/driver/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

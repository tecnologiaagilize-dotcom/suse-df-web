import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/common/ErrorBoundary'; // Módulo 10.4.4

// Driver Pages
import DriverLogin from './pages/driver/Login';
import DriverRegister from './pages/driver/Register';
import DriverDashboard from './pages/driver/Dashboard';
import ForgotPassword from './pages/driver/ForgotPassword';
import VoiceConfig from './pages/driver/VoiceConfig';
import DriverProfile from './pages/driver/Profile';
import LegalTerms from './pages/driver/LegalTerms';

// Passenger Pages
import PassengerLogin from './pages/passenger/Login';
import PassengerRegister from './pages/passenger/Register';
import PassengerDashboard from './pages/passenger/Dashboard';
import PassengerProfile from './pages/passenger/Profile';
import PassengerVoiceConfig from './pages/passenger/VoiceConfig';
import HealthProfile from './pages/passenger/health/HealthProfile';

// Professional Pages
import ProfessionalLogin from './pages/professional/Login';
import ProfessionalDashboard from './pages/professional/Dashboard';
import ProfessionalQRScanner from './pages/professional/QRScanner';
import PatientRecord from './pages/professional/PatientRecord';

import AdminDashboardReal from './pages/AdminDashboard';

import AdminLoginReal from './pages/Login';
import ChangePassword from './pages/admin/ChangePassword';
import UserManagement from './pages/admin/UserManagement';
import AuditLogs from './pages/admin/AuditLogs'; // Import added
import SharedAlert from './pages/public/SharedAlert';
// import HealthCheck from './pages/public/HealthCheck'; // Substituído pelo Guard
import HealthAccessGuard from './pages/public/HealthAccessGuard';

// Loading Component with Reset Option
const LoadingScreen = () => {
  const [showReset, setShowReset] = React.useState(false);
  
  React.useEffect(() => {
    const timer = setTimeout(() => setShowReset(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleReset = () => {
    // Clear session and reload
    localStorage.clear();
    window.location.href = '/';
  };

  return (
    <div className="flex flex-col h-screen items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
      <p className="text-gray-600 font-medium">Carregando sistema...</p>
      {showReset && (
        <button 
          onClick={handleReset}
          className="mt-6 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-red-600 hover:bg-gray-50 shadow-sm"
        >
          Demorando muito? Reiniciar Sessão
        </button>
      )}
    </div>
  );
};

// Protected Route Component
const PrivateRoute = ({ children, role }) => {
  const { user, userRole, loading } = useAuth();
  
  if (loading) return <LoadingScreen />;
  
  if (!user) return <Navigate to="/driver/login" replace />;
  
  // Adicionando 'master' como role permitida para acesso total
  if (role && userRole !== role && userRole !== 'admin' && userRole !== 'master') {
     // Se o papel do usuário não corresponder ao exigido e não for admin/master
     
     // Definição de Staff (Equipe de Gestão)
     const isStaff = ['admin', 'operator', 'supervisor', 'master'].includes(userRole);
     const requiredAdminAccess = ['admin', 'operator', 'supervisor', 'master'].includes(role);
     
     // Profissionais de Saúde
     const isProfessional = userRole === 'professional';

     // Se for staff acessando rota de staff, permite
     if (isStaff && requiredAdminAccess) {
         return children;
     } else if (isProfessional && role === 'professional') {
         return children;
     } else if (userRole === 'driver' && role === 'driver') {
         return children;
     } else if (userRole === 'passenger' && role === 'passenger') {
         return children;
     } else {
        console.warn(`Acesso negado. Requer: ${role}, Usuário é: ${userRole}`);
        
        // Redireciona para o dashboard correto
        if (isStaff) {
            return <Navigate to="/admin/dashboard" replace />;
        } else if (userRole === 'passenger') {
            return <Navigate to="/passenger/dashboard" replace />;
        } else if (userRole === 'professional') {
            return <Navigate to="/professional/dashboard" replace />;
        } else {
            // Default fallback para driver se não identificado
            return <Navigate to="/driver/dashboard" replace />;
        }
     }
  }
  
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
          {/* Public Routes */}
          <Route path="/driver/login" element={<DriverLogin />} />
          <Route path="/driver/register" element={<DriverRegister />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/tracking/:token" element={<SharedAlert />} />
          <Route path="/health/check/:token" element={<HealthAccessGuard />} />
          
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

          {/* Protected Professional Routes */}
          <Route path="/professional/login" element={<ProfessionalLogin />} />
          <Route path="/professional/dashboard" element={
            <PrivateRoute role="professional">
              <ProfessionalDashboard />
            </PrivateRoute>
          } />
          <Route path="/professional/scan" element={
            <PrivateRoute role="professional">
              <ProfessionalQRScanner />
            </PrivateRoute>
          } />
          
          <Route path="/professional/patient/:token" element={
            <PrivateRoute role="professional">
              <PatientRecord />
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

          <Route path="/driver/health" element={
            <PrivateRoute role="driver">
              <HealthProfile />
            </PrivateRoute>
          } />

          <Route path="/driver/legal-terms" element={
            <PrivateRoute role="driver">
              <LegalTerms />
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

          <Route path="/passenger/legal-terms" element={
            <PrivateRoute role="passenger">
              <LegalTerms />
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

          <Route path="/passenger/health" element={
            <PrivateRoute role="passenger">
              <HealthProfile />
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
          <Route path="/" element={<Navigate to="/passenger/login" replace />} />
          <Route path="*" element={<Navigate to="/passenger/login" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

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

import AdminDashboardReal from './pages/AdminDashboard';

import AdminLoginReal from './pages/Login';
import ChangePassword from './pages/admin/ChangePassword';
import UserManagement from './pages/admin/UserManagement';
import SharedAlert from './pages/public/SharedAlert';

// Protected Route Component
const PrivateRoute = ({ children, role }) => {
  const { user, userRole, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  
  if (!user) return <Navigate to="/driver/login" replace />;
  
  if (role && userRole !== role && userRole !== 'admin') {
     // If user role doesn't match required role (and not super admin), redirect
     // For now, simplify logic:
     return children; 
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

          {/* Protected Admin Routes */}
          <Route path="/admin/dashboard" element={
            <PrivateRoute role="admin">
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

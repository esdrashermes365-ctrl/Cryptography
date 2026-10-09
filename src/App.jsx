import { Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Login from './Pages/Login';
import Register from './Pages/Register';
import ForgotPassword from './Pages/ForgotPassword';
import ResetPassword from './Pages/ResetPassword';
import Dashboard from './Pages/Dashboard';
import EncryptPage from './Pages/EncryptPage';
import DecryptPage from './Pages/DecryptPage';
import HashPage from './Pages/HashPage';
import SignaturePage from './Pages/SignaturePage';
import ProfilPage from './Pages/ProfilPage';
import {
  ApiTenantsPage,
  AuditLogsPage,
  HelpPage,
  TenantsPage,
} from './Pages/WorkspacePages';
import { RequireAuth } from './auth/AuthContext';
import { navItems } from './navigation';

function DashboardLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0b0f17] text-white">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function OverviewPage() {
  const navigate = useNavigate();
  return <Dashboard onStartOperation={() => navigate('/encryption')} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<RequireAuth />}>
      <Route element={<DashboardLayout />}>
        {navItems.map((item) => (
          <Route
            key={item.path}
            path={item.path}
            element={
              item.path === '/overview' ? (
                <OverviewPage />
              ) : item.path === '/encryption' ? (
                <EncryptPage />
              ) : item.path === '/decryption' ? (
                <DecryptPage />
              ) : item.path === '/hashing' ? (
                <HashPage />
              ) : item.path === '/rsa-signature' ? (
                <SignaturePage />
              ) : item.path === '/tenants' ? (
                <TenantsPage />
              ) : item.path === '/audit-logs' ? (
                <AuditLogsPage />
              ) : item.path === '/api-tenants' ? (
                <ApiTenantsPage />
              ) : item.path === '/help' ? (
                <HelpPage />
              ) : item.path === '/profile' ? (
                <ProfilPage />
              ) : (
                <Navigate to="/overview" replace />
              )
            }
          />
        ))}
        <Route path="/decryption" element={<DecryptPage />} />
      </Route>
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/dashboard" element={<Navigate to="/overview" replace />} />
      <Route path="/encrypt" element={<Navigate to="/encryption" replace />} />
      <Route path="/signing" element={<Navigate to="/rsa-signature" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
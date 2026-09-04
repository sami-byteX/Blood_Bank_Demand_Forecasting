import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import { AuthProvider } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import DonorDashboard from './pages/donor/DonorDashboard';
import DonorProfile from './pages/donor/DonorProfile';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import BloodRequests from './pages/staff/BloodRequests';
import Donations from './pages/staff/Donations';
import DonorVerification from './pages/staff/DonorVerification';
import Forecasting from './pages/staff/Forecasting';
import Inventory from './pages/staff/Inventory';
import Issuance from './pages/staff/Issuance';
import StaffDashboard from './pages/staff/StaffDashboard';
import { ToastProvider } from './components/ToastNotification';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/custom.css';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Protected — all roles go through DashboardLayout */}
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>

              {/* Admin routes */}
              <Route path="/admin" element={
                <RoleGuard roles={['admin']}><AdminDashboard /></RoleGuard>
              } />
              <Route path="/admin/users" element={
                <RoleGuard roles={['admin']}><UserManagement /></RoleGuard>
              } />

              {/* Staff + Admin shared routes */}
              <Route path="/staff" element={
                <RoleGuard roles={['staff', 'admin']}><StaffDashboard /></RoleGuard>
              } />
              <Route path="/staff/verify-donor" element={
                <RoleGuard roles={['staff', 'admin']}><DonorVerification /></RoleGuard>
              } />
              <Route path="/staff/donations" element={
                <RoleGuard roles={['staff', 'admin']}><Donations /></RoleGuard>
              } />
              <Route path="/staff/requests" element={
                <RoleGuard roles={['staff', 'admin']}><BloodRequests /></RoleGuard>
              } />
              <Route path="/staff/issuance" element={
                <RoleGuard roles={['staff', 'admin']}><Issuance /></RoleGuard>
              } />
              <Route path="/staff/inventory" element={
                <RoleGuard roles={['staff', 'admin']}><Inventory /></RoleGuard>
              } />
              <Route path="/staff/forecasting" element={
                <RoleGuard roles={['staff', 'admin']}><Forecasting /></RoleGuard>
              } />

              {/* Donor routes */}
              <Route path="/donor" element={
                <RoleGuard roles={['donor']}><DonorDashboard /></RoleGuard>
              } />
              <Route path="/donor/profile" element={
                <RoleGuard roles={['donor']}><DonorProfile /></RoleGuard>
              } />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

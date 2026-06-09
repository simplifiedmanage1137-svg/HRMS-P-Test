// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import './index.css';

// Layout Components
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';

// Auth Components
import Login from './components/Auth/Login';

// Admin Components
import AdminDashboard from './components/Admin/Dashboard';
import EmployeeList from './components/Admin/EmployeeList';
import AddEmployee from './components/Admin/AddEmployee';
import EditEmployee from './components/Admin/EditEmployee';
import LeaveRequests from './components/Admin/LeaveRequests';
import LeaveReports from './components/Admin/LeaveReports';
import AttendanceDashboard from './components/Admin/AttendanceDashboard';
import AttendanceReports from './components/Admin/AttendanceReports';
import SendUpdateRequest from './components/Admin/SendUpdateRequest';
import UpdateApprovals from './components/Admin/UpdateApprovals';
import SendNotice from './components/Admin/SendNotice';
import Announcements from './components/Admin/Announcements';
import AdminBroadcast from './components/Admin/AdminBroadcast';
import EmployeeProfileView from './components/Admin/EmployeeProfileView';
import AdminRatings from './components/Admin/AdminRatings';

// Employee Components
import EmployeeDashboard from './components/Employee/Dashboard';
import Profile from './components/Employee/Profile';
import ProfileEdit from './components/Employee/ProfileEdit';
import ApplyLeave from './components/Employee/ApplyLeave';
import SalarySlip from './components/Employee/SalarySlip';
import Attendance from './components/Employee/Attendance';
import EmployeeUpdateRequests from './components/Employee/EmployeeUpdateRequests';
import EmployeeUpdateForm from './components/Employee/EmployeeUpdateForm';
import ManagerLeaveRequests from './components/Employee/ManagerLeaveRequests';
import ManagerShiftUpdate from './components/Employee/ManagerShiftUpdate';
import ManagerPanel from './components/Employee/ManagerPanel';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import GlobalNotification from './components/Common/GlobalNotification';
import { Spinner } from 'react-bootstrap';

// Private Route Component
const PrivateRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        zIndex: 9999
      }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Main App Content
function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        zIndex: 9999
      }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  // If on login page, render only login
  if (isLoginPage) {
    return <Login />;
  }

  // For all other pages, render with sidebar and navbar
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {/* Sidebar */}
      {user && <Sidebar />}

      {/* Main Content Area */}
      <div
        id="main-content-wrapper"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          backgroundColor: 'var(--body-bg)',
          transition: 'margin-left 0.25s ease'
        }}
      >
        {/* Navbar */}
        {user && <Navbar />}

        {/* Page Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '28px',
          backgroundColor: 'var(--body-bg)'
        }}>
          <Routes>
            {/* Dashboard Route - Conditional based on role */}
            <Route path="/" element={
              <PrivateRoute allowedRoles={['admin', 'employee']}>
                {user?.role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />}
              </PrivateRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={
              <PrivateRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </PrivateRoute>
            } />

            <Route path="/admin/employees" element={
              <PrivateRoute allowedRoles={['admin']}>
                <EmployeeList />
              </PrivateRoute>
            } />

            <Route path="/admin/add-employee" element={
              <PrivateRoute allowedRoles={['admin']}>
                <AddEmployee />
              </PrivateRoute>
            } />

            <Route path="/admin/edit-employee/:id" element={
              <PrivateRoute allowedRoles={['admin']}>
                <EditEmployee />
              </PrivateRoute>
            } />

            <Route path="/admin/employees/:employeeId" element={
              <PrivateRoute allowedRoles={['admin']}>
                <EmployeeProfileView />
              </PrivateRoute>
            } />

            <Route path="/admin/leave-requests" element={
              <PrivateRoute allowedRoles={['admin']}>
                <LeaveRequests />
              </PrivateRoute>
            } />

            <Route path="/admin/leave-reports" element={
              <PrivateRoute allowedRoles={['admin']}>
                <LeaveReports />
              </PrivateRoute>
            } />

            {/* Admin Attendance Routes */}
            <Route path="/admin/attendance/dashboard" element={
              <PrivateRoute allowedRoles={['admin']}>
                <AttendanceDashboard />
              </PrivateRoute>
            } />
            
            <Route path="/admin/attendance/reports" element={
              <PrivateRoute allowedRoles={['admin']}>
                <AttendanceReports />
              </PrivateRoute>
            } />

            {/* Admin Ratings Route */}
            <Route path="/admin/ratings" element={
              <PrivateRoute allowedRoles={['admin']}>
                <AdminRatings />
              </PrivateRoute>
            } />

            {/* Admin Update Routes */}
            <Route path="/employee/update-info/:requestId" element={
              <PrivateRoute allowedRoles={['employee']}>
                <EmployeeUpdateForm />
              </PrivateRoute>
            } />

            <Route path="/admin/send-update-request" element={
              <PrivateRoute allowedRoles={['admin']}>
                <SendUpdateRequest />
              </PrivateRoute>
            } />

            <Route path="/admin/update-approvals" element={
              <PrivateRoute allowedRoles={['admin']}>
                <UpdateApprovals />
              </PrivateRoute>
            } />

            {/* BROADCAST CENTER - combined notice + announcements */}
            <Route path="/admin/broadcast" element={
              <PrivateRoute allowedRoles={['admin']}>
                <AdminBroadcast />
              </PrivateRoute>
            } />
            
            {/* old routes redirect */}
            <Route path="/admin/announcements" element={<Navigate to="/admin/broadcast" replace />} />
            <Route path="/admin/send-notice" element={<Navigate to="/admin/broadcast" replace />} />

            {/* Employee Routes */}
            <Route path="/employee/dashboard" element={
              <PrivateRoute allowedRoles={['employee']}>
                <EmployeeDashboard />
              </PrivateRoute>
            } />

            <Route path="/profile" element={
              <PrivateRoute allowedRoles={['admin', 'employee']}>
                <Profile />
              </PrivateRoute>
            } />

            <Route path="/profile/edit" element={
              <PrivateRoute allowedRoles={['employee']}>
                <ProfileEdit />
              </PrivateRoute>
            } />

            <Route path="/employee/update-requests" element={
              <PrivateRoute allowedRoles={['employee']}>
                <EmployeeUpdateRequests />
              </PrivateRoute>
            } />

            <Route path="/apply-leave" element={
              <PrivateRoute allowedRoles={['employee']}>
                <ApplyLeave />
              </PrivateRoute>
            } />

            <Route path="/salary-slip" element={
              <PrivateRoute allowedRoles={['employee']}>
                <SalarySlip />
              </PrivateRoute>
            } />

            <Route path="/attendance" element={
              <PrivateRoute allowedRoles={['employee']}>
                <Attendance />
              </PrivateRoute>
            } />

            <Route path="/manager/panel" element={
              <PrivateRoute allowedRoles={['employee']}>
                <ManagerPanel />
              </PrivateRoute>
            } />

            {/* Keep old routes as redirects for backward compatibility */}
            <Route path="/manager/leave-requests" element={<Navigate to="/manager/panel" replace />} />
            <Route path="/manager/shift-update" element={<Navigate to="/manager/panel" replace />} />
            <Route path="/manager/send-notice" element={<Navigate to="/manager/panel" replace />} />

            {/* Redirect for any unknown routes */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>

      {/* Global Notification */}
      <GlobalNotification />
    </div>
  );
}

// Main App Component
function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <AppContent />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
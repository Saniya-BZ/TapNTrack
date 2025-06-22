import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import components
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import RoomFrequency from './pages/RoomFrequency';
import ManageTables from './pages/ManageTables';
import RfidEntries from './pages/RfidEntries';
import CheckinTrends from './pages/CheckinTrends';
import UserManagement from './pages/UserManagement';
import GuestRegistration from './pages/GuestRegistration';
import ManagementRegistration from './pages/ManagementRegistration';
import Helpdesk from './pages/Helpdesk'; 
import Login from './pages/Login';
import SystemHealthMonitoring from './pages/SystemHealthMonitoring'; 
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// import AllProducts from './pages/AllProducts';
import AccessControlTrackingPage from './pages/AccessControlTrackingPage';  



// CSS
import './App.css';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Role-based protected route
const RoleProtectedRoute = ({ children, allowedRoles }) => {
  const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
  const userRole = sessionStorage.getItem('userRole');
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!allowedRoles.includes(userRole)) {
    // For clerks, redirect to guest registration instead of dashboard
    if (userRole === 'clerk') {
      // return <Navigate to="/guest_registration" replace />;
      return <Navigate to="/register_guest" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  const [username, setUsername] = useState('Admin');
  
  // Get username from session storage on component mount
  useEffect(() => {
    const storedEmail = sessionStorage.getItem('userEmail');
    if (storedEmail) {
      // Extract username from email or use email as username
      const usernameFromEmail = storedEmail.split('@')[0] || storedEmail;
      setUsername(usernameFromEmail);
    }
  }, []);
  
  return (
    <Router>
      <Routes>
        {/* Login route - public */}
        <Route path="/login" element={<Login />} />

        {/* Redirect based on role: clerks to guest registration, others to dashboard */}
        <Route path="/" element={
          sessionStorage.getItem('isAuthenticated') === 'true' ? (
            sessionStorage.getItem('userRole') === 'clerk' ? 
              // <Navigate to="/guest_registration" replace /> : 
              <Navigate to="/register_guest" replace /> : 
              <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        } />

        {/* Dashboard - not accessible to clerks */}
        <Route path="/dashboard" element={
          <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'manager']}>
            <Layout username={username}>
              <Dashboard />
            </Layout>
          </RoleProtectedRoute>
        } />

        {/* Guest Registration - only for clerk, manager, admin */}
        <Route path="/register_guest" element={
          <RoleProtectedRoute allowedRoles={['clerk', 'manager', 'admin']}>
            <Layout username={username}>
              <GuestRegistration />
            </Layout>
          </RoleProtectedRoute>
        } />

        <Route 
        path="/management_registration" 
        element={
          <RoleProtectedRoute allowedRoles={['admin']}>
            <Layout username={username}>
              <ManagementRegistration />
            </Layout>
          </RoleProtectedRoute>
        } 
      />

                  
        {/* Other routes - prevent clerk access */}
        <Route path="/rfid_entries" element={
          <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'manager']}>
            <Layout username={username}>
              <RfidEntries />
            </Layout>
          </RoleProtectedRoute>
        } />
        
        <Route path="/checkin_trends" element={
          <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'manager']}>
            <Layout username={username}>
              <CheckinTrends />
            </Layout>
          </RoleProtectedRoute>
        } />
        
        <Route path="/room_frequency" element={
          <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'manager']}>
            <Layout username={username}>
              <RoomFrequency />
            </Layout>
          </RoleProtectedRoute>
        } />
        
        <Route path="/manage_tables" element={
          <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'manager']}>
            <Layout username={username}>
              <ManageTables />
            </Layout>
          </RoleProtectedRoute>
        } />
        
        {/* User Management - not accessible to clerks */}
        <Route path="/user_management" element={
          <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'manager']}>
            <Layout username={username}>
              <UserManagement />
            </Layout>
          </RoleProtectedRoute>
        } />

        {/* Helpdesk - accessible to all roles except super_admin */}
        <Route path="/helpdesk" element={
          <RoleProtectedRoute allowedRoles={['admin', 'manager', 'clerk']}>
            <Layout username={username}>
              <Helpdesk />
            </Layout>
          </RoleProtectedRoute>
        } />

        <Route path="/system_health" element={
          <RoleProtectedRoute allowedRoles={['super_admin', 'admin']}>
            <Layout username={username}>
              <SystemHealthMonitoring />
            </Layout>
          </RoleProtectedRoute>
        } />


{/* 
        <Route path="/all_products" element={
          <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'manager']}>
            <Layout username={username}>
              <AllProducts />
            </Layout>
          </RoleProtectedRoute>
        } /> */}

        <Route path="/access_control_tracking" element={
          <RoleProtectedRoute allowedRoles={['super_admin', 'admin', 'manager']}>
            <Layout username={username}>
              <AccessControlTrackingPage />
            </Layout>
          </RoleProtectedRoute>
        } />

        
        {/* Catch all other routes and redirect to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      <ToastContainer position="top-right" autoClose={3000} />
    </Router>

  


  );
}

export default App;



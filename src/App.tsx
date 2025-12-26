import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import LoginForm from './components/Auth/LoginForm';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import EmployeeList from './components/Employees/EmployeeList';
import EmployeeForm from './components/Employees/EmployeeForm';
import AttendanceTracker from './components/Attendance/AttendanceTracker';
import MonthlyReports from './components/Reports/MonthlyReports';
import AdminDashboard from './components/Admin/AdminDashboard';
import PublicAttendance from './components/Public/PublicAttendance';
import AdvancedAnalytics from './components/Analytics/AdvancedAnalytics';
import EnhancedReports from './components/Reports/EnhancedReports';
import { Employee } from './lib/supabase';

// Public Route Component (No Authentication Required)
const PublicRoute: React.FC = () => {
  return (
    <>
      <PublicAttendance />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </>
  );
};

// Protected Route Component (Authentication Required)
const ProtectedRoute: React.FC = () => {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeForm(true);
  };

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setShowEmployeeForm(true);
  };

  const handleCloseForm = () => {
    setShowEmployeeForm(false);
    setSelectedEmployee(null);
  };

  const handleSaveEmployee = () => {
    setShowEmployeeForm(false);
    setSelectedEmployee(null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'admin':
        return <AdminDashboard />;
      case 'employees':
        return <EmployeeList onEditEmployee={handleEditEmployee} />;
      case 'attendance':
        return <AttendanceTracker />;
      case 'reports':
        return <EnhancedReports />;
      case 'analytics':
        return <AdvancedAnalytics />;
      case 'add-employee':
        handleAddEmployee();
        setActiveTab('employees');
        return <EmployeeList onEditEmployee={handleEditEmployee} />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onSignOut={signOut}
      />
      
      <main className="flex-1 p-6">
        {renderContent()}
      </main>

      {showEmployeeForm && (
        <EmployeeForm
          employee={selectedEmployee}
          onClose={handleCloseForm}
          onSave={handleSaveEmployee}
        />
      )}
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/attendance" element={<PublicRoute />} />
        <Route path="/admin/*" element={<ProtectedRoute />} />
        <Route path="/" element={<Navigate to="/attendance" replace />} />
      </Routes>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
    </Router>
  );
}

export default App;
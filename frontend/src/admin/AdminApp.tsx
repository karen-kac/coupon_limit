import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import StoreManagement from './components/StoreManagement';
import CouponManagement from './components/CouponManagement';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import AdminLayout from './components/AdminLayout';
import './AdminApp.css';

function AdminAppContent() {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner">⚙️</div>
        <p>管理画面を読み込み中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin />;
  }

  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/stores" element={<StoreManagement />} />
        <Route path="/coupons" element={<CouponManagement />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AdminLayout>
  );
}

function AdminApp() {
  return (
    <BrowserRouter basename="/admin">
      <AdminAuthProvider>
        <div className="admin-app">
          <AdminAppContent />
        </div>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

export default AdminApp;
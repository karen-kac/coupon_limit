import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface Admin {
  id: string;
  email: string;
  role: 'store_owner' | 'super_admin';
  linked_store_id?: string;
  is_active: boolean;
}

interface Store {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  owner_email: string;
}

interface AdminAuthContextType {
  admin: Admin | null;
  store: Store | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAdmin: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

interface AdminAuthProviderProps {
  children: ReactNode;
}

// Admin API functions
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const getAdminAuthToken = (): string | null => {
  return localStorage.getItem('admin_auth_token');
};

const setAdminAuthToken = (token: string): void => {
  localStorage.setItem('admin_auth_token', token);
};

const removeAdminAuthToken = (): void => {
  localStorage.removeItem('admin_auth_token');
};

const adminAuthFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getAdminAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
};

const loginAdmin = async (email: string, password: string): Promise<{ access_token: string; admin: Admin }> => {
  const response = await fetch(`${API_BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '管理者ログインに失敗しました');
  }
  
  const data = await response.json();
  if (data.access_token) {
    setAdminAuthToken(data.access_token);
  }
  return data;
};

const getCurrentAdmin = async (): Promise<Admin> => {
  const response = await adminAuthFetch(`${API_BASE_URL}/admin/auth/me`);
  if (!response.ok) {
    throw new Error('管理者情報の取得に失敗しました');
  }
  return response.json();
};

const getAdminStore = async (): Promise<Store | null> => {
  const response = await adminAuthFetch(`${API_BASE_URL}/admin/stores`);
  if (!response.ok) {
    throw new Error('店舗情報の取得に失敗しました');
  }
  const stores = await response.json();
  return stores.length > 0 ? stores[0] : null;
};

const verifyAdminToken = async (): Promise<boolean> => {
  const token = getAdminAuthToken();
  if (!token) return false;
  
  try {
    const response = await adminAuthFetch(`${API_BASE_URL}/admin/auth/verify`);
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const AdminAuthProvider: React.FC<AdminAuthProviderProps> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuthStatus = async () => {
    const token = getAdminAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // Verify token is still valid
      const isValid = await verifyAdminToken();
      if (!isValid) {
        removeAdminAuthToken();
        setAdmin(null);
        setStore(null);
        setLoading(false);
        return;
      }

      // Get current admin info
      const adminData = await getCurrentAdmin();
      setAdmin(adminData);

      // Get store info if store owner
      if (adminData.role === 'store_owner') {
        const storeData = await getAdminStore();
        setStore(storeData);
      }
    } catch (error) {
      console.error('Admin auth check failed:', error);
      removeAdminAuthToken();
      setAdmin(null);
      setStore(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const res = await loginAdmin(email, password);
      setAdmin(res.admin);
      
      // Get store info if store owner
      if (res.admin.role === 'store_owner') {
        const storeData = await getAdminStore();
        setStore(storeData);
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    removeAdminAuthToken();
    setAdmin(null);
    setStore(null);
  };

  const refreshAdmin = async () => {
    try {
      const adminData = await getCurrentAdmin();
      setAdmin(adminData);
      
      if (adminData.role === 'store_owner') {
        const storeData = await getAdminStore();
        setStore(storeData);
      }
    } catch (error) {
      console.error('Failed to refresh admin:', error);
      logout();
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const value: AdminAuthContextType = {
    admin,
    store,
    loading,
    isAuthenticated: !!admin,
    login,
    logout,
    refreshAdmin,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};
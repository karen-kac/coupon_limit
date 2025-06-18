import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getCurrentUser, verifyToken, removeAuthToken, getAuthToken } from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuthStatus = async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // Verify token is still valid
      const isValid = await verifyToken();
      if (!isValid) {
        removeAuthToken();
        setUser(null);
        setLoading(false);
        return;
      }

      // Get current user info
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Auth check failed:', error);
      removeAuthToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = (token: string, userData: User) => {
    setUser(userData);
  };

  const logout = () => {
    removeAuthToken();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      logout();
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
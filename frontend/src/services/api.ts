import { Coupon, UserCoupon, Location } from '../types';

// Environment-based API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 
                     process.env.REACT_APP_API_BASE_URL + '/api' || 
                     'http://localhost:8000/api';

// Token management
export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('auth_token');
};

// Authenticated fetch wrapper
const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = getAuthToken();
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

export const getCoupons = async (lat: number, lng: number, radius: number = 1000): Promise<Coupon[]> => {
  try {
    console.log(`Fetching coupons for lat: ${lat}, lng: ${lng}, radius: ${radius}`);
    const response = await authFetch(`${API_BASE_URL}/coupons?lat=${lat}&lng=${lng}&radius=${radius}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`Failed to fetch coupons: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Received coupons:', data);
    return data;
  } catch (error) {
    console.error('getCoupons error:', error);
    throw error;
  }
};

export const getUserCoupons = async (userId?: string): Promise<UserCoupon[]> => {
  // If userId is not provided, backend will use authenticated user
  const endpoint = `${API_BASE_URL}/user/coupons`;
  const response = await authFetch(endpoint);
  if (!response.ok) {
    throw new Error('Failed to fetch user coupons');
  }
  return response.json();
};

export const getCoupon = async (couponId: string, userLocation: Location, userId?: string): Promise<any> => {
  const response = await authFetch(`${API_BASE_URL}/coupons/get`, {
    method: 'POST',
    body: JSON.stringify({
      coupon_id: couponId,
      user_location: userLocation,
      user_id: userId, // Optional, backend can use authenticated user
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get coupon');
  }
  
  return response.json();
};

export const applyCoupon = async (userId: string, couponId: string): Promise<any> => {
  const response = await authFetch(`${API_BASE_URL}/user/${userId}/coupons/${couponId}/use`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to use coupon');
  }
  return response.json();
};

// ユーザーログイン
export const loginUser = async (email: string, password: string): Promise<{ access_token: string; user: any }> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'ログインに失敗しました');
  }
  const data = await response.json();
  if (data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
};

// ユーザー新規登録
export const registerUser = async (name: string, email: string, password: string): Promise<{ access_token: string; user: any }> => {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '登録に失敗しました');
  }
  const data = await response.json();
  if (data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
};

// ユーザー情報取得
export const getCurrentUser = async (): Promise<any> => {
  const response = await authFetch(`${API_BASE_URL}/auth/me`);
  if (!response.ok) {
    throw new Error('Failed to get user info');
  }
  return response.json();
};

// ユーザーログアウト
export const logoutUser = async (): Promise<void> => {
  removeAuthToken();
  // If backend has logout endpoint, call it here
  try {
    await authFetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
  } catch (error) {
    console.log('Logout API call failed, but token removed locally');
  }
};

// トークン検証
export const verifyToken = async (): Promise<boolean> => {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    const response = await authFetch(`${API_BASE_URL}/auth/verify`);
    return response.ok;
  } catch (error) {
    return false;
  }
};
import { UserCoupon, Location, Coupon } from '../types';
import axios from 'axios';

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

export const getCoupons = async (lat: number, lng: number, radius: number = 5000): Promise<Coupon[]> => {
  console.log(`Fetching coupons for lat: ${lat}, lng: ${lng}, radius: ${radius}`);
  
  try {
    // Try multiple endpoints in order of preference
    const endpoints = [
      { 
        url: `${API_BASE_URL}/coupons?lat=${lat}&lng=${lng}&radius=${radius}`, 
        requiresAuth: true  // Main endpoint requires authentication for filtering
      },
      { 
        url: `${API_BASE_URL}/coupons/external-test?lat=${lat}&lng=${lng}&radius=${radius}`, 
        requiresAuth: false 
      },
      { 
        url: `${API_BASE_URL}/coupons/simple-test`, 
        requiresAuth: false 
      }
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint.url} (auth: ${endpoint.requiresAuth})`);
        
        // --- ここからがaxiosへの変更箇所 ---

        // 変更点 1: axios用の設定オブジェクトを作成
        const config: any = {
          params: endpoint.params // URLに付与するパラメータ
        };

        // 変更点 2: 認証が必要な場合にヘッダーを追加
        if (endpoint.requiresAuth) {
          const token = getAuthToken();
          if (token) {
            config.headers = { 'Authorization': `Bearer ${token}` };
          }
        }

        // 変更点 3: axios.getでAPIを呼び出す
        const response = await axios.get(endpoint.url, config);

        // 変更点 4: response.okのチェックは不要。axiosは2xx以外をエラーとしてcatchする
        // 成功した場合、データは response.data に格納されている
        const data = response.data;
        
        // --- ここまでがaxiosへの変更箇所 ---
          
        // Handle different response formats
        let coupons: Coupon[] = [];

        if (data.external_coupons) {
          // External test endpoint format
          coupons = data.external_coupons.map((coupon: any) => ({
            id: coupon.id,
            store_name: coupon.store_name,
            shop_name: coupon.shop_name,
            title: coupon.title,
            current_discount: coupon.current_discount,
            location: coupon.location,
            expires_at: coupon.expires_at,
            time_remaining_minutes: coupon.time_remaining_minutes,
            distance_meters: coupon.distance_meters,
            description: coupon.description,
            source: coupon.source,
            external_url: coupon.external_url // Use URL from backend
          }));
        } else if (Array.isArray(data)) {
          // Standard coupons endpoint format (main endpoint)
          coupons = data.map((coupon: any) => ({
            id: coupon.id,
            store_name: coupon.store_name,
            shop_name: coupon.store_name, // Use store_name for consistency
            title: coupon.title,
            current_discount: coupon.current_discount,
            location: coupon.location,
            expires_at: coupon.expires_at,
            time_remaining_minutes: coupon.time_remaining_minutes,
            distance_meters: coupon.distance_meters,
            description: coupon.description,
            source: coupon.source || 'internal',
            external_url: coupon.external_url // Use URL from backend
          }));
        }

        console.log('Successfully fetched coupons:', coupons);
        return coupons;
      } catch (error) {
        console.warn(`Endpoint ${endpoint.url} failed:`, error);
        continue;
      }
    }
  } catch (error) {
    console.error('Error fetching coupons:', error);
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

export const applyCoupon = async (couponId: string): Promise<any> => {
  const response = await authFetch(`${API_BASE_URL}/user/coupons/${couponId}/use`, {
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
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

// Mock coupons for fallback
const getMockCoupons = (lat: number, lng: number): Coupon[] => {
  return [
    {
      id: 'mock_1',
      store_name: 'サンプル東京駅店',
      shop_name: 'サンプル東京駅店',
      title: 'テスト用クーポン 50% OFF',
      current_discount: 50,
      location: { lat: lat + 0.001, lng: lng + 0.001 },
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      time_remaining_minutes: 120,
      distance_meters: 150,
      description: 'これはテスト用のクーポンです',
      source: 'external',
      external_url: 'https://example.com'
    },
    {
      id: 'mock_2',
      store_name: 'サンプル渋谷店',
      shop_name: 'サンプル渋谷店',
      title: 'テスト用クーポン 30% OFF',
      current_discount: 30,
      location: { lat: lat - 0.001, lng: lng - 0.001 },
      expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      time_remaining_minutes: 180,
      distance_meters: 200,
      description: 'これはテスト用のクーポンです',
      source: 'external',
      external_url: 'https://example.com'
    }
  ];
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
        
        // Use authFetch for authenticated endpoints, regular fetch for others
        const response = endpoint.requiresAuth 
          ? await authFetch(endpoint.url) 
          : await fetch(endpoint.url);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Received data:', data);
          
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
        }
      } catch (error) {
        console.warn(`Endpoint ${endpoint.url} failed:`, error);
        continue;
      }
    }
    
    // If all endpoints fail, return mock data
    console.warn('All API endpoints failed, using mock data');
    return getMockCoupons(lat, lng);
    
  } catch (error) {
    console.error('getCoupons error:', error);
    console.log('Returning mock coupons due to API error');
    return getMockCoupons(lat, lng);
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
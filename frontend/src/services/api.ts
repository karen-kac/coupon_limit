import { Coupon, UserCoupon, Location } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

export const getCoupons = async (lat: number, lng: number, radius: number = 1000): Promise<Coupon[]> => {
  const response = await fetch(`${API_BASE_URL}/coupons?lat=${lat}&lng=${lng}&radius=${radius}`);
  if (!response.ok) {
    throw new Error('Failed to fetch coupons');
  }
  return response.json();
};

export const getUserCoupons = async (userId: string): Promise<UserCoupon[]> => {
  const response = await fetch(`${API_BASE_URL}/user/${userId}/coupons`);
  if (!response.ok) {
    throw new Error('Failed to fetch user coupons');
  }
  return response.json();
};

export const getCoupon = async (couponId: string, userLocation: Location, userId: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/coupons/get`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coupon_id: couponId,
      user_location: userLocation,
      user_id: userId,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get coupon');
  }
  
  return response.json();
};

export const couponApi = async (userId: string, couponId: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/user/${userId}/coupons/${couponId}/use`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to use coupon');
  }
  
  return response.json();
};
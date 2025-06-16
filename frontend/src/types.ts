export interface Location {
  lat: number;
  lng: number;
}

export interface Coupon {
  id: string;
  shop_name: string;
  title: string;
  current_discount: number;
  location: Location;
  expires_at: string;
  time_remaining_minutes: number;
  distance_meters?: number;
}

export interface UserCoupon {
  id: string;
  coupon_id: string;
  user_id: string;
  shop_name: string;
  title: string;
  discount: number;
  obtained_at: string;
  is_used: boolean;
  used_at?: string;
}
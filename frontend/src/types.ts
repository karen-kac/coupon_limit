export interface Location {
  lat: number;
  lng: number;
}

export interface Coupon {
  id: string;
  store_name?: string; // バックエンドは店舗検索では store_name を返すがUserCouponでは shop_name
  shop_name?: string; // UserCouponで使用される代替フィールド
  title: string;
  current_discount: number;
  location: Location;
  expires_at: string;
  time_remaining_minutes: number;
  distance_meters?: number;
  description?: string;
  source?: string; // "internal", "external", "hotpepper", "kumapon"
  external_url?: string; // For external coupons
  external_id?: string; // For external coupons
  image_url?: string; // For external coupons
  // Hot Pepper specific fields
  genre?: string;
  budget?: string;
  access?: string;
  open_time?: string;
  close_time?: string;
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
  store_name?: string; // 管理画面API用の追加フィールド
}
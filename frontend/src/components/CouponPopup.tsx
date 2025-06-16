import React, { useState, useEffect } from 'react';
import { Coupon, Location } from '../types';

interface CouponPopupProps {
  coupon: Coupon;
  userLocation: Location | null;
  onClose: () => void;
  onGetCoupon: (coupon: Coupon) => void;
}

const CouponPopup: React.FC<CouponPopupProps> = ({ coupon, userLocation, onClose, onGetCoupon }) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isNearby, setIsNearby] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    if (userLocation) {
      const dist = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        coupon.location.lat,
        coupon.location.lng
      );
      setDistance(dist);
      setIsNearby(dist <= 20);
    }
  }, [userLocation, coupon.location]);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const expiresAt = new Date(coupon.expires_at);
      const diff = expiresAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeRemaining('期限切れ');
        return;
      }
      
      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [coupon.expires_at]);

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleGetCoupon = () => {
    if (isNearby) {
      onGetCoupon(coupon);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="popup active" onClick={handleBackdropClick}>
      <div className="popup-content">
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>
        
        <div className="popup-header">
          <h3>{coupon.shop_name}</h3>
          {distance !== null && (
            <span className={`distance ${isNearby ? 'nearby' : 'far'}`}>
              {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`}
            </span>
          )}
        </div>
        
        <div className="popup-body">
          <div className="discount-rate">
            {coupon.current_discount}% OFF
          </div>
          
          <div className="coupon-title">
            {coupon.title}
          </div>
          
          <div className="time-remaining">
            残り {timeRemaining}
          </div>
          
          <div className="coupon-details">
            {distance !== null && (
              <div className={`distance-info ${isNearby ? 'nearby' : 'far'}`}>
                {isNearby ? (
                  <span className="status-nearby">
                    ✅ 取得可能エリア内です
                  </span>
                ) : (
                  <span className="status-far">
                    📍 あと{Math.round(distance - 20)}m近づく必要があります
                  </span>
                )}
              </div>
            )}
          </div>
          
          <button
            className={`get-btn ${isNearby ? 'enabled' : 'disabled'}`}
            onClick={handleGetCoupon}
            disabled={!isNearby}
          >
            <span className="btn-text">
              {isNearby ? 'クーポンを取得' : 'クーポンを取得'}
            </span>
            <span className="btn-distance">
              {isNearby ? '取得可能' : '（20m以内で取得可能）'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CouponPopup;
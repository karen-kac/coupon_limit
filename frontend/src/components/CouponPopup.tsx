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
      setIsNearby(dist <= 300);
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
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (days > 0) {
        setTimeRemaining(`${days}日 ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeRemaining(`${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
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
    if (coupon.source === 'external' || coupon.source === 'hotpepper' || coupon.source === 'kumapon' || coupon.source === 'yahoo') {
      // For external coupons, open the external URL
      let externalUrl = coupon.external_url;
      
      // Generate fallback URL if not provided
      if (!externalUrl && (coupon.source === 'kumapon' || coupon.id.startsWith('kumapon_'))) {
        const couponId = coupon.id.replace('kumapon_', '');
        const issueDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        externalUrl = `https://kumapon.jp/deals/${issueDate}kpd${couponId}`;
      } else if (!externalUrl && (coupon.source === 'hotpepper' || coupon.id.startsWith('hotpepper_'))) {
        const shopId = coupon.external_id || coupon.id.replace('hotpepper_', '');
        externalUrl = `https://www.hotpepper.jp/strJ${shopId}/`;
      } else if (!externalUrl && (coupon.source === 'yahoo' || coupon.id.startsWith('yahoo_'))) {
        const shopId = coupon.external_id || coupon.id.replace('yahoo_', '');
        externalUrl = `https://map.yahoo.co.jp/place/${shopId}`;
      }
      
      if (externalUrl) {
        window.open(externalUrl, '_blank');
      } else {
        alert('このクーポンの詳細ページは利用できません');
      }
    } else if (isNearby) {
      // For internal coupons, use the normal flow
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
          <h3>{coupon.store_name || coupon.shop_name}</h3>
          <div className="header-info">
            {coupon.source === 'hotpepper' && (
              <span className="hotpepper-badge">ホットペッパー 🍽️</span>
            )}
            {coupon.source === 'yahoo' && (
              <span className="yahoo-badge">Yahoo地図 🗺️</span>
            )}
            {coupon.source === 'external' && (
              <span className="external-badge">外部クーポン 🌐</span>
            )}
            {coupon.source === 'kumapon' && (
              <span className="external-badge">くまポン 🐻</span>
            )}
            {distance !== null && (
              <span className={`distance ${isNearby ? 'nearby' : 'far'}`}>
                {distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`}
              </span>
            )}
          </div>
        </div>
        
        <div className="popup-body">
          <div className="discount-rate">
            {coupon.current_discount}% OFF
          </div>
          
          <div className="coupon-title">
            {coupon.title}
          </div>
          
          {coupon.description && (
            <div className="coupon-description">
              {coupon.description}
            </div>
          )}
          
          {coupon.source === 'hotpepper' && (
            <div className="hotpepper-details">
              {(coupon as any).genre && (
                <div className="detail-item">
                  <span className="detail-label">ジャンル:</span>
                  <span className="detail-value">{(coupon as any).genre}</span>
                </div>
              )}
              {(coupon as any).budget && (
                <div className="detail-item">
                  <span className="detail-label">予算:</span>
                  <span className="detail-value">{(coupon as any).budget}</span>
                </div>
              )}
              {(coupon as any).access && (
                <div className="detail-item">
                  <span className="detail-label">アクセス:</span>
                  <span className="detail-value">{(coupon as any).access}</span>
                </div>
              )}
            </div>
          )}
          
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
                    📍 あと{Math.round(distance - 300)}m近づく必要があります
                  </span>
                )}
              </div>
            )}
          </div>
          
          <button
            className={`get-btn ${(coupon.source === 'external' || coupon.source === 'hotpepper' || coupon.source === 'kumapon' || coupon.source === 'yahoo') ? 'external' : (isNearby ? 'enabled' : 'disabled')}`}
            onClick={handleGetCoupon}
            disabled={!(coupon.source === 'external' || coupon.source === 'hotpepper' || coupon.source === 'kumapon' || coupon.source === 'yahoo') && !isNearby}
          >
            <span className="btn-text">
              {coupon.source === 'hotpepper' 
                ? 'ホットペッパーで確認'
                : coupon.source === 'yahoo'
                ? 'Yahoo地図で確認'
                : coupon.source === 'external' || coupon.source === 'kumapon'
                ? 'クーポンサイトを開く'
                : (isNearby ? 'クーポンを取得' : 'クーポンを取得')
              }
            </span>
            <span className="btn-distance">
              {coupon.source === 'hotpepper' 
                ? 'お店の詳細とクーポン'
                : coupon.source === 'yahoo'
                ? 'Yahoo地図で詳細確認'
                : coupon.source === 'external' || coupon.source === 'kumapon'
                ? '外部サイトで確認'
                : (isNearby ? '取得可能' : '（300m以内で取得可能）')
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CouponPopup;
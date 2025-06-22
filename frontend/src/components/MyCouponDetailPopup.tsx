import React, { useState } from 'react';
import { UserCoupon } from '../types';

interface MyCouponDetailPopupProps {
  coupon: UserCoupon;
  onClose: () => void;
  onUseCoupon: (coupon: UserCoupon) => void;
}

const MyCouponDetailPopup: React.FC<MyCouponDetailPopupProps> = ({ 
  coupon, 
  onClose, 
  onUseCoupon 
}) => {
  const [isSwipeReady, setIsSwipeReady] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSwipeStart = () => {
    if (coupon.is_used) return;
    setIsSwipeReady(true);
  };

  const handleSwipeMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isSwipeReady || coupon.is_used) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const progress = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    setSwipeProgress(progress);
  };

  const handleSwipeEnd = () => {
    if (!isSwipeReady || coupon.is_used) return;
    
    if (swipeProgress > 0.7) {
      onUseCoupon(coupon);
    } else {
      setSwipeProgress(0);
    }
    setIsSwipeReady(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="popup active" onClick={handleBackdropClick}>
      <div className="popup-content my-coupon-detail">
        <button className="close-btn" onClick={onClose}>
          &times;
        </button>
        
        <div className="popup-header">
          <h3>{coupon.shop_name || coupon.store_name}</h3>
          <div className="discount-badge-large">
            {coupon.discount}% OFF
          </div>
        </div>
        
        <div className="popup-body">
          <div className="coupon-title">
            {coupon.title}
          </div>
          
          <div className="coupon-info">
            <div className="info-row">
              <span className="info-label">取得日時:</span>
              <span className="info-value">{formatDate(coupon.obtained_at)}</span>
            </div>
            
            {coupon.is_used && coupon.used_at && (
              <div className="info-row">
                <span className="info-label">使用日時:</span>
                <span className="info-value">{formatDate(coupon.used_at)}</span>
              </div>
            )}
            
            <div className="info-row">
              <span className="info-label">ステータス:</span>
              <span className={`info-value status ${coupon.is_used ? 'used' : 'unused'}`}>
                {coupon.is_used ? '使用済み' : '未使用'}
              </span>
            </div>
          </div>
          
          {!coupon.is_used && (
            <div className="swipe-to-use-section">
              <p className="swipe-instruction">
                下のボタンを右にスワイプして使用
              </p>
              
              <div 
                className="swipe-button-container"
                onTouchStart={handleSwipeStart}
                onTouchMove={handleSwipeMove}
                onTouchEnd={handleSwipeEnd}
                onMouseDown={handleSwipeStart}
                onMouseMove={handleSwipeMove}
                onMouseUp={handleSwipeEnd}
                onMouseLeave={handleSwipeEnd}
              >
                <div className="swipe-track">
                  <div 
                    className="swipe-progress" 
                    style={{ width: `${swipeProgress * 100}%` }}
                  />
                  <div 
                    className="swipe-handle"
                    style={{ left: `${swipeProgress * (100 - 12)}%` }}
                  >
                    <div className="swipe-handle-arrow"></div>
                  </div>
                  <div className="swipe-text">
                    {swipeProgress > 0.7 ? '離して使用' : 'スワイプして使用'}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {coupon.is_used && (
            <div className="used-badge">
              <span className="used-icon">✅</span>
              <span>このクーポンは使用済みです</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyCouponDetailPopup;
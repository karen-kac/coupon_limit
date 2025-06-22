import React, { useState } from 'react';
import { UserCoupon } from '../types';
import { applyCoupon } from '../services/api';
import MyCouponDetailPopup from './MyCouponDetailPopup';

interface MyPageProps {
  coupons: UserCoupon[];
  onRefresh: () => void;
}

const MyPage: React.FC<MyPageProps> = ({ coupons, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'my-coupons' | 'favorites'>('my-coupons');
  const [loading, setLoading] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<UserCoupon | null>(null);

  const sortedCoupons = [...coupons]
    .sort((a, b) => {
      if (a.is_used !== b.is_used) {
        return a.is_used ? 1 : -1;
      }
      return new Date(b.obtained_at).getTime() - new Date(a.obtained_at).getTime();
    });

  const handleUseCoupon = async (coupon: UserCoupon) => {
    if (coupon.is_used) return;
    
    setLoading(true);
    try {
      await applyCoupon(coupon.id);
      onRefresh();
    } catch (error: any) {
      alert(error.message || 'Failed to use coupon');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="mypage-view">
      <div className="page-header">
        <h1>マイページ</h1>
        <button onClick={onRefresh} className="refresh-btn">🔄</button>
      </div>
      
      <div className="filter-tabs">
        <button
          className={`filter-tab ${activeTab === 'my-coupons' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-coupons')}
        >
          マイクーポン ({coupons.length})
        </button>
        <button
          className={`filter-tab ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => setActiveTab('favorites')}
        >
          お気に入り (0)
        </button>
      </div>

      <div className="coupon-list">
        {activeTab === 'my-coupons' ? (
          sortedCoupons.length === 0 ? (
            <div className="empty-state">
              <p>まだクーポンがありません</p>
              <p>マップでクーポンを探してみましょう！</p>
            </div>
          ) : (
            sortedCoupons.map(coupon => (
            <div
              key={coupon.id}
              className={`coupon-item ${coupon.is_used ? 'used' : ''}`}
              onClick={() => setSelectedCoupon(coupon)}
              style={{ cursor: 'pointer' }}
            >
              <div className="coupon-header">
                <span className="shop-name">{coupon.shop_name || coupon.store_name}</span>
                <span className="discount-badge">{coupon.discount}% OFF</span>
              </div>
              
              <div className="coupon-title">{coupon.title}</div>
              
              <div className="coupon-meta">
                <span className="obtained-date">
                  取得: {formatDate(coupon.obtained_at)}
                </span>
                <span className={`status ${coupon.is_used ? 'used' : 'unused'}`}>
                  {coupon.is_used ? (
                    `使用済み (${formatDate(coupon.used_at!)})`
                  ) : (
                    '未使用 - タップして詳細'
                  )}
                </span>
              </div>
              
              {coupon.is_used && (
                <div className="used-overlay">
                  <span>使用済み</span>
                </div>
              )}
            </div>
          ))
        )) : (
          <div className="empty-state">
            <p>お気に入り機能は準備中です</p>
            <p>外部クーポンをお気に入りに追加できるようになります</p>
          </div>
        )}
      </div>
      
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">🎫</div>
          <p>クーポンを使用中...</p>
        </div>
      )}
      
      {selectedCoupon && (
        <MyCouponDetailPopup
          coupon={selectedCoupon}
          onClose={() => setSelectedCoupon(null)}
          onUseCoupon={handleUseCoupon}
        />
      )}
    </div>
  );
};

export default MyPage;
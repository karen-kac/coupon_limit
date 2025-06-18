import React, { useState } from 'react';
import { UserCoupon } from '../types';
import { useCoupon } from '../services/api';

interface MyPageProps {
  coupons: UserCoupon[];
  onRefresh: () => void;
}

const MyPage: React.FC<MyPageProps> = ({ coupons, onRefresh }) => {
  const [filter, setFilter] = useState<'all' | 'unused' | 'used'>('all');
  const [loading, setLoading] = useState(false);

  const filteredCoupons = coupons.filter(coupon => {
    if (filter === 'unused') return !coupon.is_used;
    if (filter === 'used') return coupon.is_used;
    return true;
  });

  const handleUseCoupon = async (coupon: UserCoupon) => {
    if (coupon.is_used) return;
    
    setLoading(true);
    try {
      await useCoupon(coupon.user_id, coupon.id);
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
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          すべて ({coupons.length})
        </button>
        <button
          className={`filter-tab ${filter === 'unused' ? 'active' : ''}`}
          onClick={() => setFilter('unused')}
        >
          未使用 ({coupons.filter(c => !c.is_used).length})
        </button>
        <button
          className={`filter-tab ${filter === 'used' ? 'active' : ''}`}
          onClick={() => setFilter('used')}
        >
          使用済み ({coupons.filter(c => c.is_used).length})
        </button>
      </div>

      <div className="coupon-list">
        {filteredCoupons.length === 0 ? (
          <div className="empty-state">
            {filter === 'all' ? (
              <>
                <p>まだクーポンがありません</p>
                <p>マップでクーポンを探してみましょう！</p>
              </>
            ) : filter === 'unused' ? (
              <>
                <p>未使用のクーポンがありません</p>
                <p>新しいクーポンを取得してみましょう！</p>
              </>
            ) : (
              <>
                <p>使用済みのクーポンがありません</p>
              </>
            )}
          </div>
        ) : (
          filteredCoupons.map(coupon => (
            <div
              key={coupon.id}
              className={`coupon-item ${coupon.is_used ? 'used' : ''}`}
              onClick={() => !coupon.is_used && handleUseCoupon(coupon)}
              style={{ cursor: coupon.is_used ? 'default' : 'pointer' }}
            >
              <div className="coupon-header">
                <span className="shop-name">{coupon.shop_name}</span>
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
                    '未使用 - タップして使用'
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
        )}
      </div>
      
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner">🎫</div>
          <p>クーポンを使用中...</p>
        </div>
      )}
    </div>
  );
};

export default MyPage;
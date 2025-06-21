import React, { useState, useEffect } from 'react';
import { UserCoupon } from '../types';
import { getUserCoupons } from '../services/api';

interface CouponHistoryPopupProps {
  onClose: () => void;
}

const CouponHistoryPopup: React.FC<CouponHistoryPopupProps> = ({ onClose }) => {
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCoupons = async () => {
      try {
        const data = await getUserCoupons();
        setUserCoupons(data);
      } catch (error) {
        console.error('Error loading user coupons:', error);
        setError('クーポン履歴の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadCoupons();
  }, []);

  // 使用済み・期限切れクーポンをフィルター
  const historyFiltered = userCoupons.filter(coupon => {
    if (coupon.is_used) return true;
    
    // 期限切れチェック（簡易版）
    const now = new Date();
    const obtainedAt = new Date(coupon.obtained_at);
    const hoursSinceObtained = (now.getTime() - obtainedAt.getTime()) / (1000 * 60 * 60);
    
    // 24時間で期限切れと仮定（実際のロジックは backend に依存）
    return hoursSinceObtained > 24;
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (coupon: UserCoupon) => {
    if (coupon.is_used) {
      return (
        <span style={{
          backgroundColor: '#4caf50',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          使用済み
        </span>
      );
    } else {
      return (
        <span style={{
          backgroundColor: '#999',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600'
        }}>
          期限切れ
        </span>
      );
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={handleBackdropClick}
    >
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)'
      }}>
        {/* ヘッダー */}
        <div style={{
          padding: '24px 24px 16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{
            margin: 0,
            color: '#e6543a',
            fontSize: '20px',
            fontWeight: '700',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
          }}>
            📋 クーポン履歴
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              color: '#666',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f0f0f0';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ×
          </button>
        </div>

        {/* コンテンツ */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 24px 24px'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 0',
              color: '#666'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏳</div>
              <p>読み込み中...</p>
            </div>
          ) : error ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 0',
              color: '#ff4444'
            }}>
              <p>{error}</p>
            </div>
          ) : historyFiltered.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 0',
              color: '#666',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
              <p style={{ margin: 0, fontSize: '16px' }}>
                まだ使用済み・期限切れの<br />クーポンはありません
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {historyFiltered.map((coupon) => (
                <div
                  key={coupon.id}
                  style={{
                    backgroundColor: '#f9f9f9',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #e0e0e0'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#333',
                      flex: 1,
                      marginRight: '12px'
                    }}>
                      {coupon.title}
                    </h3>
                    {getStatusBadge(coupon)}
                  </div>
                  
                  <p style={{
                    margin: '4px 0',
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    🏪 {coupon.shop_name}
                  </p>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px'
                  }}>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#e6543a'
                    }}>
                      {coupon.discount}%OFF
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: '#999'
                    }}>
                      取得: {formatDate(coupon.obtained_at)}
                    </span>
                  </div>
                  
                  {coupon.used_at && (
                    <div style={{
                      fontSize: '12px',
                      color: '#4caf50',
                      marginTop: '4px'
                    }}>
                      使用: {formatDate(coupon.used_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CouponHistoryPopup;
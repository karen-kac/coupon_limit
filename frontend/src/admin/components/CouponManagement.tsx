import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';

interface Coupon {
  id: string;
  store_id: string;
  store_name: string;
  title: string;
  description?: string;
  discount_rate_initial: number;
  current_discount: number;
  start_time: string;
  end_time: string;
  active_status: 'active' | 'expired' | 'exploded';
  created_at: string;
}

interface CouponCreate {
  store_id: string;
  title: string;
  description?: string;
  discount_rate_initial: number;
  start_time: string;
  end_time: string;
  discount_rate_schedule?: Array<{time_remain_min: number, rate: number}>;
}

interface UserCouponDetail {
  id: string;
  user_name: string;
  user_email: string;
  coupon_title: string;
  store_name: string;
  discount: number;
  obtained_at: string;
  status: string;
  used_at?: string;
}

const CouponManagement: React.FC = () => {
  const { admin, store } = useAdminAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [couponUsers, setCouponUsers] = useState<UserCouponDetail[]>([]);
  const [createForm, setCreateForm] = useState<CouponCreate>({
    store_id: store?.id || '',
    title: '',
    description: '',
    discount_rate_initial: 10,
    start_time: new Date().toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    discount_rate_schedule: [
      { time_remain_min: 60, rate: 20 },
      { time_remain_min: 30, rate: 30 },
      { time_remain_min: 10, rate: 50 }
    ]
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

  const getAdminAuthToken = (): string | null => {
    return localStorage.getItem('admin_auth_token');
  };

  const adminAuthFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = getAdminAuthToken();
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

  const fetchCoupons = async () => {
    try {
      const response = await adminAuthFetch(`${API_BASE_URL}/admin/coupons`);
      if (!response.ok) {
        throw new Error('クーポン一覧の取得に失敗しました');
      }
      const data = await response.json();
      setCoupons(data);
    } catch (err: any) {
      setError(err.message || 'クーポン一覧の取得に失敗しました');
    }
  };

  const fetchCouponUsers = async (couponId: string) => {
    try {
      const response = await adminAuthFetch(`${API_BASE_URL}/admin/coupons/${couponId}/users`);
      if (!response.ok) {
        throw new Error('クーポン利用者の取得に失敗しました');
      }
      const data = await response.json();
      setCouponUsers(data);
    } catch (err: any) {
      setError(err.message || 'クーポン利用者の取得に失敗しました');
    }
  };

  const createCoupon = async () => {
    try {
      const response = await adminAuthFetch(`${API_BASE_URL}/admin/coupons`, {
        method: 'POST',
        body: JSON.stringify(createForm)
      });

      if (!response.ok) {
        throw new Error('クーポンの作成に失敗しました');
      }

      await fetchCoupons();
      setShowCreateForm(false);
      setCreateForm({
        store_id: store?.id || '',
        title: '',
        description: '',
        discount_rate_initial: 10,
        start_time: new Date().toISOString().slice(0, 16),
        end_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        discount_rate_schedule: [
          { time_remain_min: 60, rate: 20 },
          { time_remain_min: 30, rate: 30 },
          { time_remain_min: 10, rate: 50 }
        ]
      });
    } catch (err: any) {
      setError(err.message || 'クーポンの作成に失敗しました');
    }
  };

  const deleteCoupon = async (couponId: string) => {
    if (!window.confirm('このクーポンを削除しますか？')) {
      return;
    }

    try {
      const response = await adminAuthFetch(`${API_BASE_URL}/admin/coupons/${couponId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('クーポンの削除に失敗しました');
      }

      await fetchCoupons();
    } catch (err: any) {
      setError(err.message || 'クーポンの削除に失敗しました');
    }
  };

  const duplicateCoupon = (coupon: Coupon) => {
    const now = new Date();
    const defaultEndTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    setCreateForm({
      store_id: coupon.store_id,
      title: `${coupon.title} (コピー)`,
      description: coupon.description,
      discount_rate_initial: coupon.discount_rate_initial,
      start_time: now.toISOString().slice(0, 16),
      end_time: defaultEndTime.toISOString().slice(0, 16),
      discount_rate_schedule: [
        { time_remain_min: 60, rate: 20 },
        { time_remain_min: 30, rate: 30 },
        { time_remain_min: 10, rate: 50 }
      ]
    });
    setShowCreateForm(true);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchCoupons();
      setLoading(false);
    };

    loadData();
  }, []);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'expired': return '#f44336';
      case 'exploded': return '#ff9800';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'アクティブ';
      case 'expired': return '期限切れ';
      case 'exploded': return '爆発済み';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner">⚙️</div>
        <p>クーポン一覧を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="coupon-management">
      <div className="coupon-header">
        <h1>クーポン管理</h1>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="create-coupon-btn"
        >
          ➕ 新しいクーポンを作成
        </button>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {showCreateForm && (
        <div className="create-coupon-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>新しいクーポンを作成</h2>
              <button 
                onClick={() => setShowCreateForm(false)}
                className="close-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); createCoupon(); }}>
              <div className="form-group">
                <label>タイトル *</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({...createForm, title: e.target.value})}
                  placeholder="例: コーヒー1杯無料"
                  required
                />
              </div>

              <div className="form-group">
                <label>説明</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  placeholder="クーポンの詳細を入力してください"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>初期割引率 (%) *</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={createForm.discount_rate_initial}
                  onChange={(e) => setCreateForm({...createForm, discount_rate_initial: parseInt(e.target.value)})}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>配布開始時間 *</label>
                  <input
                    type="datetime-local"
                    value={createForm.start_time}
                    onChange={(e) => setCreateForm({...createForm, start_time: e.target.value})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>配布終了時間 *</label>
                  <input
                    type="datetime-local"
                    value={createForm.end_time}
                    onChange={(e) => setCreateForm({...createForm, end_time: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>動的割引スケジュール</label>
                <div className="discount-schedule">
                  {createForm.discount_rate_schedule?.map((schedule, index) => (
                    <div key={index} className="schedule-item">
                      <input
                        type="number"
                        min="1"
                        placeholder="残り時間(分)"
                        value={schedule.time_remain_min}
                        onChange={(e) => {
                          const newSchedule = [...(createForm.discount_rate_schedule || [])];
                          newSchedule[index].time_remain_min = parseInt(e.target.value);
                          setCreateForm({...createForm, discount_rate_schedule: newSchedule});
                        }}
                      />
                      <span>分前に</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="割引率(%)"
                        value={schedule.rate}
                        onChange={(e) => {
                          const newSchedule = [...(createForm.discount_rate_schedule || [])];
                          newSchedule[index].rate = parseInt(e.target.value);
                          setCreateForm({...createForm, discount_rate_schedule: newSchedule});
                        }}
                      />
                      <span>%割引</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          const newSchedule = (createForm.discount_rate_schedule || []).filter((_, i) => i !== index);
                          setCreateForm({...createForm, discount_rate_schedule: newSchedule});
                        }}
                        className="remove-schedule-btn"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button"
                    onClick={() => {
                      const newSchedule = [...(createForm.discount_rate_schedule || [])];
                      newSchedule.push({ time_remain_min: 15, rate: 25 });
                      setCreateForm({...createForm, discount_rate_schedule: newSchedule});
                    }}
                    className="add-schedule-btn"
                  >
                    ➕ スケジュール追加
                  </button>
                </div>
                <small>残り時間が短いほど割引率を高く設定してください</small>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)}>
                  キャンセル
                </button>
                <button type="submit" className="primary">
                  作成
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="coupons-grid">
        {coupons.length > 0 ? (
          coupons.map((coupon) => (
            <div key={coupon.id} className="coupon-card">
              <div className="coupon-header">
                <h3>{coupon.title}</h3>
                <span 
                  className="coupon-status"
                  style={{ color: getStatusColor(coupon.active_status) }}
                >
                  {getStatusText(coupon.active_status)}
                </span>
              </div>

              <div className="coupon-content">
                <p className="coupon-description">{coupon.description}</p>
                
                <div className="coupon-details">
                  <div className="detail-item">
                    <strong>初期割引率:</strong> {coupon.discount_rate_initial}%
                  </div>
                  <div className="detail-item">
                    <strong>現在の割引率:</strong> {coupon.current_discount}%
                  </div>
                  <div className="detail-item">
                    <strong>開始時間:</strong> {formatDateTime(coupon.start_time)}
                  </div>
                  <div className="detail-item">
                    <strong>終了時間:</strong> {formatDateTime(coupon.end_time)}
                  </div>
                </div>
              </div>

              <div className="coupon-actions">
                <button 
                  onClick={() => {
                    setSelectedCoupon(coupon);
                    fetchCouponUsers(coupon.id);
                  }}
                  className="view-users-btn"
                >
                  📊 利用者を見る
                </button>
                <button 
                  onClick={() => duplicateCoupon(coupon)}
                  className="duplicate-btn"
                >
                  📋 複製
                </button>
                <button 
                  onClick={() => deleteCoupon(coupon.id)}
                  className="delete-btn"
                >
                  🗑️ 削除
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>まだクーポンがありません</p>
            <button onClick={() => setShowCreateForm(true)}>
              最初のクーポンを作成
            </button>
          </div>
        )}
      </div>

      {selectedCoupon && (
        <div className="coupon-users-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{selectedCoupon.title} の利用者</h2>
              <button 
                onClick={() => {
                  setSelectedCoupon(null);
                  setCouponUsers([]);
                }}
                className="close-btn"
              >
                ✕
              </button>
            </div>

            <div className="users-list">
              {couponUsers.length > 0 ? (
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>ユーザー名</th>
                      <th>メール</th>
                      <th>割引率</th>
                      <th>取得日時</th>
                      <th>ステータス</th>
                      <th>使用日時</th>
                    </tr>
                  </thead>
                  <tbody>
                    {couponUsers.map((userCoupon) => (
                      <tr key={userCoupon.id}>
                        <td>{userCoupon.user_name}</td>
                        <td>{userCoupon.user_email}</td>
                        <td>{userCoupon.discount}%</td>
                        <td>{formatDateTime(userCoupon.obtained_at)}</td>
                        <td>
                          <span className={`status-badge ${userCoupon.status}`}>
                            {userCoupon.status === 'used' ? '使用済み' : 
                             userCoupon.status === 'obtained' ? '取得済み' : '期限切れ'}
                          </span>
                        </td>
                        <td>
                          {userCoupon.used_at ? formatDateTime(userCoupon.used_at) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>このクーポンはまだ誰にも取得されていません</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CouponManagement;
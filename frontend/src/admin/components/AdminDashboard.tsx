import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';

interface AdminStats {
  total_stores: number;
  total_coupons: number;
  active_coupons: number;
  total_users: number;
  coupons_obtained_today: number;
}

interface RecentActivity {
  id: string;
  type: 'coupon_created' | 'coupon_obtained' | 'coupon_used';
  description: string;
  timestamp: string;
}

const AdminDashboard: React.FC = () => {
  const { admin, store } = useAdminAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const fetchStats = async () => {
    try {
      const response = await adminAuthFetch(`${API_BASE_URL}/admin/stats`);
      if (!response.ok) {
        throw new Error('統計情報の取得に失敗しました');
      }
      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message || '統計情報の取得に失敗しました');
    }
  };

  const fetchRecentActivity = async () => {
    // Mock data for now - implement actual API call later
    const mockActivity: RecentActivity[] = [
      {
        id: '1',
        type: 'coupon_obtained',
        description: 'コーヒーショップクーポンが取得されました',
        timestamp: new Date().toISOString()
      },
      {
        id: '2',
        type: 'coupon_created',
        description: '新しいクーポンが作成されました',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: '3',
        type: 'coupon_used',
        description: 'レストランクーポンが使用されました',
        timestamp: new Date(Date.now() - 7200000).toISOString()
      }
    ];
    setRecentActivity(mockActivity);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchRecentActivity()]);
      setLoading(false);
    };

    loadData();
  }, []);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ja-JP');
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'coupon_created': return '➕';
      case 'coupon_obtained': return '🎫';
      case 'coupon_used': return '✅';
      default: return '📝';
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner">⚙️</div>
        <p>ダッシュボードを読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>ダッシュボード</h1>
        <p>
          ようこそ、{admin?.role === 'store_owner' ? store?.name : 'スーパー管理者'}さん
        </p>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="stats-grid">
        {admin?.role === 'super_admin' && (
          <div className="stat-card">
            <div className="stat-icon">🏪</div>
            <div className="stat-content">
              <h3>総店舗数</h3>
              <div className="stat-number">{stats?.total_stores || 0}</div>
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-icon">🎫</div>
          <div className="stat-content">
            <h3>総クーポン数</h3>
            <div className="stat-number">{stats?.total_coupons || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>アクティブ</h3>
            <div className="stat-number">{stats?.active_coupons || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>総ユーザー数</h3>
            <div className="stat-number">{stats?.total_users || 0}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>今日の取得数</h3>
            <div className="stat-number">{stats?.coupons_obtained_today || 0}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="recent-activity-section">
          <h2>最近のアクティビティ</h2>
          <div className="activity-list">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="activity-content">
                    <p>{activity.description}</p>
                    <small>{formatTimestamp(activity.timestamp)}</small>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-activity">アクティビティがありません</p>
            )}
          </div>
        </div>

        <div className="quick-actions-section">
          <h2>クイックアクション</h2>
          <div className="quick-actions">
            <button className="quick-action-btn primary">
              ➕ 新しいクーポンを作成
            </button>
            <button className="quick-action-btn">
              📊 詳細レポートを表示
            </button>
            <button className="quick-action-btn">
              🔔 通知設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
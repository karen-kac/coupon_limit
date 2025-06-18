import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';

interface Store {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  owner_email: string;
  created_at: string;
  is_active: boolean;
}

interface StoreCreate {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
}

const StoreManagement: React.FC = () => {
  const { admin } = useAdminAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<StoreCreate>({
    name: '',
    description: '',
    latitude: 35.6812,
    longitude: 139.7671,
    address: ''
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

  const fetchStores = async () => {
    try {
      const response = await adminAuthFetch(`${API_BASE_URL}/admin/stores`);
      if (!response.ok) {
        throw new Error('店舗一覧の取得に失敗しました');
      }
      const data = await response.json();
      setStores(data);
    } catch (err: any) {
      setError(err.message || '店舗一覧の取得に失敗しました');
    }
  };

  const createStore = async () => {
    try {
      const response = await adminAuthFetch(`${API_BASE_URL}/admin/stores`, {
        method: 'POST',
        body: JSON.stringify(createForm)
      });

      if (!response.ok) {
        throw new Error('店舗の作成に失敗しました');
      }

      await fetchStores();
      setShowCreateForm(false);
      setCreateForm({
        name: '',
        description: '',
        latitude: 35.6812,
        longitude: 139.7671,
        address: ''
      });
    } catch (err: any) {
      setError(err.message || '店舗の作成に失敗しました');
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCreateForm({
            ...createForm,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error('位置情報の取得に失敗しました:', error);
        }
      );
    }
  };

  const getLocationFromAddress = async () => {
    if (!createForm.address) {
      alert('住所を入力してください');
      return;
    }

    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      alert('Google Maps APIキーが設定されていません');
      return;
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(createForm.address)}&key=${apiKey}`
      );
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        setCreateForm({
          ...createForm,
          latitude: location.lat,
          longitude: location.lng
        });
        alert('住所から緯度経度を取得しました！');
      } else {
        alert('住所から緯度経度の取得に失敗しました。住所を確認してください。');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      alert('住所の変換でエラーが発生しました');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchStores();
      setLoading(false);
    };

    loadData();
  }, []);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  // Check if user is super admin
  if (admin?.role !== 'super_admin') {
    return (
      <div className="access-denied">
        <h1>アクセス拒否</h1>
        <p>この機能はスーパー管理者のみアクセス可能です。</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner">⚙️</div>
        <p>店舗一覧を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="store-management">
      <div className="store-header">
        <h1>店舗管理</h1>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="create-store-btn"
        >
          ➕ 新しい店舗を追加
        </button>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {showCreateForm && (
        <div className="create-store-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>新しい店舗を追加</h2>
              <button 
                onClick={() => setShowCreateForm(false)}
                className="close-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); createStore(); }}>
              <div className="form-group">
                <label>店舗名 *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                  placeholder="例: 東京駅コーヒーショップ"
                  required
                />
              </div>

              <div className="form-group">
                <label>説明</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  placeholder="店舗の詳細を入力してください"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>住所</label>
                <div className="address-input-group">
                  <input
                    type="text"
                    value={createForm.address}
                    onChange={(e) => setCreateForm({...createForm, address: e.target.value})}
                    placeholder="例: 東京都千代田区丸の内1-1-1"
                  />
                  <button 
                    type="button" 
                    onClick={getLocationFromAddress}
                    className="address-geocode-btn"
                  >
                    🗺️ 緯度経度を取得
                  </button>
                </div>
                <small>住所を入力後、ボタンを押すと自動で緯度経度が設定されます</small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>緯度 *</label>
                  <input
                    type="number"
                    step="any"
                    value={createForm.latitude}
                    onChange={(e) => setCreateForm({...createForm, latitude: parseFloat(e.target.value)})}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>経度 *</label>
                  <input
                    type="number"
                    step="any"
                    value={createForm.longitude}
                    onChange={(e) => setCreateForm({...createForm, longitude: parseFloat(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div className="location-helper">
                <button 
                  type="button" 
                  onClick={getCurrentLocation}
                  className="location-btn"
                >
                  📍 現在位置を取得
                </button>
                <small>緯度・経度は小数点以下6桁まで入力可能です</small>
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

      <div className="stores-grid">
        {stores.length > 0 ? (
          stores.map((store) => (
            <div key={store.id} className="store-card">
              <div className="store-header">
                <h3>{store.name}</h3>
                <span className={`store-status ${store.is_active ? 'active' : 'inactive'}`}>
                  {store.is_active ? 'アクティブ' : '非アクティブ'}
                </span>
              </div>

              <div className="store-content">
                <p className="store-description">{store.description}</p>
                
                <div className="store-details">
                  <div className="detail-item">
                    <strong>住所:</strong> {store.address || '未設定'}
                  </div>
                  <div className="detail-item">
                    <strong>オーナー:</strong> {store.owner_email}
                  </div>
                  <div className="detail-item">
                    <strong>位置:</strong> {store.latitude.toFixed(6)}, {store.longitude.toFixed(6)}
                  </div>
                  <div className="detail-item">
                    <strong>作成日:</strong> {formatDateTime(store.created_at)}
                  </div>
                </div>
              </div>

              <div className="store-actions">
                <button className="view-location-btn">
                  🗺️ 地図で表示
                </button>
                <button className="edit-btn">
                  ✏️ 編集
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <p>まだ店舗がありません</p>
            <button onClick={() => setShowCreateForm(true)}>
              最初の店舗を追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreManagement;
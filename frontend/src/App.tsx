import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import MapView from './components/MapView';
import MyPage from './components/MyPage';
import Settings from './components/Settings';
import CouponPopup from './components/CouponPopup';
import { Coupon, UserCoupon, Location } from './types';
import { getCoupons, getUserCoupons, getCoupon } from './services/api';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import { AuthProvider, useAuth } from './context/AuthContext';

function MainApp() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'map' | 'mypage' | 'settings'>('mypage');
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [previousCouponIds, setPreviousCouponIds] = useState<Set<string>>(new Set());
  const [expiringCoupons, setExpiringCoupons] = useState<Set<string>>(new Set());
  const POLLING_INTERVAL = 30000; // 30秒ごとに更新

  // データ比較用のヘルパー関数
  const isDataEqual = useCallback((newData: any[], currentData: any[]) => {
    if (newData.length !== currentData.length) return false;
    return JSON.stringify(newData) === JSON.stringify(currentData);
  }, []);

  const loadCoupons = useCallback(async (isInitialLoad = false) => {
    if (!userLocation) {
      console.log('loadCoupons: No user location available');
      return;
    }
    
    console.log('🔄 Loading coupons for location:', userLocation, isInitialLoad ? '(initial load)' : '(background update)');
    
    // 初回ロード時のみローディング状態をtrueにする
    if (isInitialLoad) {
      setLoading(true);
    }
    
    try {
      const data = await getCoupons(userLocation.lat, userLocation.lng);
      console.log('✅ Successfully loaded coupons:', data.length, 'items');
      
      // 新たに期限切れになったクーポンを検出
      if (!isInitialLoad && previousCouponIds.size > 0) {
        const currentIds = new Set(data.map(c => c.id));
        const newlyExpired = Array.from(previousCouponIds).filter(id => !currentIds.has(id));
        
        if (newlyExpired.length > 0) {
          console.log('🎆 Newly expired coupons detected:', newlyExpired);
          setExpiringCoupons(prev => new Set([...Array.from(prev), ...newlyExpired]));
        }
      }
      
      // 前回のクーポンIDセットを更新
      setPreviousCouponIds(new Set(data.map(c => c.id)));
      
      // データが同じ場合は更新をスキップ
      setCoupons(prevCoupons => {
        if (isDataEqual(data, prevCoupons)) {
          console.log('📋 Coupons data unchanged, skipping update');
          return prevCoupons;
        }
        console.log('🔄 Coupons data changed, updating:', data.length, 'items');
        return data;
      });
      
      setError(null);
    } catch (error) {
      console.error('❌ Error loading coupons:', error);
      
      // Still try to set mock data as fallback
      const mockCoupons = [
        {
          id: 'fallback_1',
          store_name: 'テスト店舗 1',
          shop_name: 'テスト店舗 1',
          title: 'フォールバック クーポン 30% OFF',
          current_discount: 30,
          location: { lat: userLocation.lat + 0.001, lng: userLocation.lng + 0.001 },
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          time_remaining_minutes: 120,
          distance_meters: 150,
          description: 'API取得に失敗したためのテスト用クーポンです',
          source: 'external' as const,
          external_url: 'https://example.com'
        },
        {
          id: 'fallback_2',
          store_name: 'テスト店舗 2',
          shop_name: 'テスト店舗 2',
          title: 'フォールバック クーポン 50% OFF',
          current_discount: 50,
          location: { lat: userLocation.lat - 0.001, lng: userLocation.lng - 0.001 },
          expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          time_remaining_minutes: 180,
          distance_meters: 250,
          description: 'API取得に失敗したためのテスト用クーポンです',
          source: 'external' as const,
          external_url: 'https://example.com'
        }
      ];
      
      console.log('🔄 Using fallback mock coupons:', mockCoupons.length);
      setPreviousCouponIds(new Set(mockCoupons.map(c => c.id)));
      setCoupons(prevCoupons => {
        if (isDataEqual(mockCoupons, prevCoupons)) {
          return prevCoupons;
        }
        return mockCoupons;
      });
      setError('クーポンの取得に失敗しましたが、テスト用データを表示しています');
    } finally {
      // 初回ロード時のみローディング状態をfalseにする
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  }, [userLocation, isDataEqual]);

  const loadUserCoupons = useCallback(async (isInitialLoad = false) => {
    if (!isAuthenticated) return;
    
    try {
      const data = await getUserCoupons();
      
      // データが同じ場合は更新をスキップ
      setUserCoupons(prevUserCoupons => {
        if (isDataEqual(data, prevUserCoupons)) {
          console.log('📋 User coupons data unchanged, skipping update');
          return prevUserCoupons;
        }
        console.log('✅ User coupons data changed, updating:', data.length, 'items', isInitialLoad ? '(initial load)' : '(background update)');
        return data;
      });
    } catch (error) {
      console.error('Error loading user coupons:', error);
    }
  }, [isAuthenticated, isDataEqual]);

  // フィルタリングされたクーポンをメモ化
  const filteredCoupons = useMemo(() => {
    if (!isAuthenticated) return coupons;
    
    const filtered = coupons.filter((coupon: Coupon) => 
      !userCoupons.some(uc => uc.coupon_id === coupon.id)
    );
    
    return filtered;
  }, [coupons, userCoupons, isAuthenticated]);

  // スプラッシュスクリーンと位置情報の取得
  useEffect(() => {
    getCurrentLocation();
    // スプラッシュスクリーンを2.5秒後に非表示
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // 初回データ取得のみ
  useEffect(() => {
    if (!userLocation || !isAuthenticated) return;

    loadCoupons(true); // 初回ロード時はローディング表示
    loadUserCoupons(true);
  }, [userLocation, isAuthenticated, loadCoupons, loadUserCoupons]);

  // ポーリング設定（別のuseEffect）
  useEffect(() => {
    if (!userLocation || !isAuthenticated) return;

    const couponInterval = setInterval(loadCoupons, POLLING_INTERVAL);
    const userCouponInterval = setInterval(loadUserCoupons, POLLING_INTERVAL);

    return () => {
      clearInterval(couponInterval);
      clearInterval(userCouponInterval);
    };
  }, [userLocation, isAuthenticated, loadCoupons, loadUserCoupons]);

  // クライアントサイドでの期限切れ監視
  useEffect(() => {
    if (coupons.length === 0) return;

    const timers = coupons.map(coupon => {
      const expiryTime = new Date(coupon.expires_at).getTime();
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;
      
      // 期限切れまで60秒以内の場合のみ監視
      if (timeUntilExpiry > 0 && timeUntilExpiry <= 60000) {
        console.log(`⏰ Setting expiration timer for coupon ${coupon.id} in ${Math.round(timeUntilExpiry/1000)}s`);
        return setTimeout(() => {
          console.log('🎆 Client-side expiration detected for coupon:', coupon.id);
          setExpiringCoupons(prev => new Set([...Array.from(prev), coupon.id]));
        }, timeUntilExpiry);
      }
      return null;
    }).filter(Boolean);
    
    return () => {
      timers.forEach(timer => timer && clearTimeout(timer));
    };
  }, [coupons]);


  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        // Fallback to Tokyo Station for demo
        setUserLocation({
          lat: 35.6812,
          lng: 139.7671,
        });
        setLoading(false);
      }
    );
  };

  const handleGetCoupon = async (coupon: Coupon) => {
    if (!userLocation || !isAuthenticated) return;
    
    try {
      await getCoupon(coupon.id, userLocation);
      setSelectedCoupon(null);
      loadUserCoupons();
      loadCoupons();
    } catch (error: any) {
      alert(error.message || 'Failed to get coupon');
    }
  };

  const handleExplosionComplete = useCallback((couponId: string) => {
    console.log('🎆 Explosion completed for coupon:', couponId);
    setExpiringCoupons(prev => {
      const next = new Set(prev);
      next.delete(couponId);
      return next;
    });
  }, []);


  if (showSplash) {
    return (
      <div className="splash-screen custom-splash">
        <div className="splash-content">
          <h1 className="splash-title">Coupon Limit</h1>
          <p className="splash-subtitle">📍 あなたの街のクーポンを見つけよう!</p>
          <div className="splash-svg-area">
            <img
              src="/icon/splash-removebg-preview.png"
              alt="Coupon Icon"
              style={{
                width: "380px",
                maxWidth: "90vw",
                height: "auto",
                display: "block",
                margin: "0 auto"
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">📍</div>
        <p>{authLoading ? '認証確認中...' : '位置情報を取得中...'}</p>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="App">
      <header className="app-header" style={{ position: 'relative' }}>
        <h1>COUPON LIMIT</h1>
        <p className="app-description">近くのクーポンを探して、お得にショッピング！</p>
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', alignItems: 'center', gap: 12 }} className="desktop-only">
          <span style={{ 
            color: '#e6543a', 
            fontWeight: '600',
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
          }}>
            こんにちは、{user?.name}さん
          </span>
          <button 
            onClick={logout}
            style={{ 
              background: 'linear-gradient(135deg, #ff4444 0%, #e6543a 100%)', 
              border: 'none', 
              color: 'white', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              boxShadow: '0 2px 6px rgba(255,68,68,0.3)',
              transition: 'all 0.2s ease',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(255,68,68,0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(255,68,68,0.3)';
            }}
          >
            ログアウト
          </button>
        </div>
      </header>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          <span className="icon">📍</span>
          <span>マップ</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'mypage' ? 'active' : ''}`}
          onClick={() => setActiveTab('mypage')}
        >
          <span className="icon">👤</span>
          <span>マイページ</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <span className="icon">⚙️</span>
          <span>設定</span>
        </button>
      </nav>

      <main className="content">
        {activeTab === 'map' ? (
          <MapView
            userLocation={userLocation}
            coupons={filteredCoupons}
            onCouponClick={setSelectedCoupon}
            error={error}
            expiringCoupons={expiringCoupons}
            onExplosionComplete={handleExplosionComplete}
          />
        ) : activeTab === 'mypage' ? (
          <MyPage
            coupons={userCoupons}
            onRefresh={loadUserCoupons}
          />
        ) : (
          <Settings />
        )}
      </main>

      {selectedCoupon && (
        <CouponPopup
          coupon={selectedCoupon}
          userLocation={userLocation}
          onClose={() => setSelectedCoupon(null)}
          onGetCoupon={handleGetCoupon}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={<MainApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
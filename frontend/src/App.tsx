import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import MapView from './components/MapView';
import MyPage from './components/MyPage';
import Settings from './components/Settings';
import CouponPopup from './components/CouponPopup';
import { Coupon, UserCoupon, Location } from './types';
import { getCoupons, getUserCoupons, getCoupon, getInternalCoupons, getExternalCoupons } from './services/api';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import { AuthProvider, useAuth } from './context/AuthContext';

function MainApp() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'map' | 'mypage' | 'settings'>('mypage');
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [internalCoupons, setInternalCoupons] = useState<Coupon[]>([]);
  const [externalCoupons, setExternalCoupons] = useState<Coupon[]>([]);
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  
  // 期限切れ検出と爆発エフェクト用の状態
  const [expiringCoupons, setExpiringCoupons] = useState<Set<string>>(new Set());
  const [previousCouponIds, setPreviousCouponIds] = useState<Set<string>>(new Set());
  
  // 内部クーポンは30秒、外部クーポンは1時間、ユーザークーポンは30秒
  const INTERNAL_COUPON_POLLING_INTERVAL = 30000; // 30秒
  const EXTERNAL_COUPON_POLLING_INTERVAL = 3600000; // 1時間 (60 * 60 * 1000)
  const USER_COUPON_POLLING_INTERVAL = 30000; // 30秒

  // データ比較用のヘルパー関数
  const isDataEqual = useCallback((newData: any[], currentData: any[]) => {
    if (newData.length !== currentData.length) return false;
    return JSON.stringify(newData) === JSON.stringify(currentData);
  }, []);

  // 内部クーポンのロード
  const loadInternalCoupons = useCallback(async (isInitialLoad = false) => {
    if (!userLocation) {
      console.log('loadInternalCoupons: No user location available');
      return;
    }
    
    console.log('🔄 Loading internal coupons for location:', userLocation, isInitialLoad ? '(initial load)' : '(background update)');
    
    try {
      const data = await getInternalCoupons(userLocation.lat, userLocation.lng);
      console.log('✅ Successfully loaded internal coupons:', data.length, 'items');
      
      // データが同じ場合は更新をスキップ
      setInternalCoupons(prevCoupons => {
        if (isDataEqual(data, prevCoupons)) {
          console.log('📋 Internal coupons data unchanged, skipping update');
          return prevCoupons;
        }
        console.log('🔄 Internal coupons data changed, updating:', data.length, 'items');
        return data;
      });
      
    } catch (error) {
      console.error('❌ Error loading internal coupons:', error);
    }
  }, [userLocation, isDataEqual]);

  // 外部クーポンのロード
  const loadExternalCoupons = useCallback(async (isInitialLoad = false) => {
    if (!userLocation) {
      console.log('loadExternalCoupons: No user location available');
      return;
    }
    
    console.log('🔄 Loading external coupons for location:', userLocation, isInitialLoad ? '(initial load)' : '(hourly update)');
    
    try {
      const data = await getExternalCoupons(userLocation.lat, userLocation.lng);
      console.log('✅ Successfully loaded external coupons:', data.length, 'items');
      
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
      setExternalCoupons(prevCoupons => {
        if (isDataEqual(data, prevCoupons)) {
          console.log('📋 External coupons data unchanged, skipping update');
          return prevCoupons;
        }
        console.log('🔄 External coupons data changed, updating:', data.length, 'items');
        return data;
      });
      
    } catch (error) {
      console.error('❌ Error loading external coupons:', error);
      
      // フォールバック用のモックデータ
      const mockCoupons = [
        {
          id: 'fallback_external_1',
          store_name: 'テスト外部店舗 1',
          shop_name: 'テスト外部店舗 1',
          title: 'フォールバック 外部クーポン 30% OFF',
          current_discount: 30,
          location: { lat: userLocation.lat + 0.001, lng: userLocation.lng + 0.001 },
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          time_remaining_minutes: 120,
          distance_meters: 150,
          description: '外部API取得に失敗したためのテスト用クーポンです',
          source: 'external' as const,
          external_url: 'https://example.com'
        }
      ];

       console.log('🔄 Using fallback mock external coupons:', mockCoupons.length);
      // ここもpreviousCouponIdsを更新する必要があります
      setPreviousCouponIds(new Set(mockCoupons.map(c => c.id)));
      setExternalCoupons(prevCoupons => {
        if (isDataEqual(mockCoupons, prevCoupons)) {
          return prevCoupons;
        }
        return mockCoupons;
      });
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

  // 結合されたクーポンリストをメモ化
  const allCoupons = useMemo(() => {
    return [...internalCoupons, ...externalCoupons];
  }, [internalCoupons, externalCoupons]);

  // フィルタリングされたクーポンをメモ化
  const filteredCoupons = useMemo(() => {
    if (!isAuthenticated) return allCoupons;
    
    const filtered = allCoupons.filter((coupon: Coupon) => 
      !userCoupons.some(uc => uc.coupon_id === coupon.id)
    );
    
    return filtered;
  }, [allCoupons, userCoupons, isAuthenticated]);

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

    console.log('🚀 Initial data loading started');
    
    // 初回ロード時はローディング表示
    setLoading(true);
    
    // 内部クーポンと外部クーポンを並行して取得
    Promise.all([
      loadInternalCoupons(true),
      loadExternalCoupons(true),
      loadUserCoupons(true)
    ]).finally(() => {
      setLoading(false);
      setError(null);
    });
  }, [userLocation, isAuthenticated, loadInternalCoupons, loadExternalCoupons, loadUserCoupons]);

  // 内部クーポンのポーリング設定（30秒間隔）
  useEffect(() => {
    if (!userLocation || !isAuthenticated) return;

    console.log('🔄 Setting up internal coupon polling (30 seconds)');
    const internalInterval = setInterval(() => {
      loadInternalCoupons(false);
    }, INTERNAL_COUPON_POLLING_INTERVAL);

    return () => {
      console.log('🛑 Clearing internal coupon polling');
      clearInterval(internalInterval);
    };
  }, [userLocation, isAuthenticated, loadInternalCoupons]);

  // 外部クーポンのポーリング設定（1時間間隔）
  useEffect(() => {
    if (!userLocation || !isAuthenticated) return;

    console.log('🔄 Setting up external coupon polling (1 hour)');
    const externalInterval = setInterval(() => {
      loadExternalCoupons(false);
    }, EXTERNAL_COUPON_POLLING_INTERVAL);

    return () => {
      console.log('🛑 Clearing external coupon polling');
      clearInterval(externalInterval);
    };
  }, [userLocation, isAuthenticated, loadExternalCoupons]);

  // ユーザークーポンのポーリング設定（30秒間隔）
  useEffect(() => {
    if (!userLocation || !isAuthenticated) return;

    console.log('🔄 Setting up user coupon polling (30 seconds)');
    const userCouponInterval = setInterval(() => {
      loadUserCoupons(false);
    }, USER_COUPON_POLLING_INTERVAL);

    return () => {
      console.log('🛑 Clearing user coupon polling');
      clearInterval(userCouponInterval);
    };
  }, [userLocation, isAuthenticated, loadUserCoupons]);

  // クライアントサイドでの期限切れ監視
  useEffect(() => {
    if (allCoupons.length === 0) return;

    const timers = allCoupons.map(coupon => {
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
  }, [allCoupons]);

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
      
      // クーポン取得後、ユーザークーポンを再読み込み
      loadUserCoupons();
      
      // 内部クーポンも再読み込み（獲得済みクーポンの除外のため）
      if (coupon.source === 'internal') {
        loadInternalCoupons();
      } else {
        loadExternalCoupons();
      }
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
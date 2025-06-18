import React, { useState, useEffect } from 'react';
import './App.css';
import MapView from './components/MapView';
import MyPage from './components/MyPage';
import CouponPopup from './components/CouponPopup';
import { Coupon, UserCoupon, Location } from './types';
import { getCoupons, getUserCoupons, getCoupon } from './services/api';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';

function MainApp() {
  const [activeTab, setActiveTab] = useState<'map' | 'mypage'>('map');
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [userId] = useState('user-' + Math.random().toString(36).substr(2, 9));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    getCurrentLocation();
    // スプラッシュスクリーンを2.5秒後に非表示
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (userLocation) {
      loadCoupons();
      loadUserCoupons();
    }
  }, [userLocation]);

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

  const loadCoupons = async () => {
    if (!userLocation) return;
    
    try {
      const data = await getCoupons(userLocation.lat, userLocation.lng);
      setCoupons(data);
    } catch (error) {
      console.error('Error loading coupons:', error);
      setError('Failed to load coupons');
    }
  };

  const loadUserCoupons = async () => {
    try {
      const data = await getUserCoupons(userId);
      setUserCoupons(data);
    } catch (error) {
      console.error('Error loading user coupons:', error);
    }
  };

  const handleGetCoupon = async (coupon: Coupon) => {
    if (!userLocation) return;
    
    try {
      await getCoupon(coupon.id, userLocation, userId);
      setSelectedCoupon(null);
      loadUserCoupons();
      loadCoupons();
    } catch (error: any) {
      alert(error.message || 'Failed to get coupon');
    }
  };

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

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">📍</div>
        <p>位置情報を取得中...</p>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="app-header" style={{ position: 'relative' }}>
        <h1>COUPON LIMIT</h1>
        <p className="app-description">近くのクーポンを探して、お得にショッピング！</p>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <Link to="/login" style={{ marginRight: 12, textDecoration: 'none', color: '#1976d2', fontWeight: 'bold' }}>ログイン</Link>
          <Link to="/register" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold' }}>新規登録</Link>
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
      </nav>

      <main className="content">
        {activeTab === 'map' ? (
          <MapView
            userLocation={userLocation}
            coupons={coupons}
            onCouponClick={setSelectedCoupon}
            error={error}
          />
        ) : (
          <MyPage
            coupons={userCoupons}
            onRefresh={loadUserCoupons}
          />
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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Coupon, Location } from '../types';
import ExplosionEffect from './ExplosionEffect';
import './ExplosionEffect.css';

interface MapViewProps {
  userLocation: Location | null;
  coupons: Coupon[];
  onCouponClick: (coupon: Coupon) => void;
  error: string | null;
  expiringCoupons: Set<string>;
  onExplosionComplete: (couponId: string) => void;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const MapView: React.FC<MapViewProps> = ({ userLocation, coupons, onCouponClick, error, expiringCoupons, onExplosionComplete }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const explosionOverlaysRef = useRef<Map<string, any>>(new Map()); // クーポンIDと爆発オーバーレイのマップ
  const userMarkerRef = useRef<any>(null);
  const isMapInitializedRef = useRef(false);
  const [showExplosion, setShowExplosion] = useState(false);

  // デバッグログを追加
  React.useEffect(() => {
    console.log('MapView received coupons:', coupons);
    console.log('MapView userLocation:', userLocation);
    console.log('MapView error:', error);
  }, [coupons, userLocation, error]);

  const updateMarkers = useCallback(() => {

    console.log('updateMarkers called');
    console.log('mapInstanceRef.current:', !!mapInstanceRef.current);
    console.log('window.google:', !!window.google);
    console.log('coupons to process:', coupons.length);
    console.log('expiringCoupons:', Array.from(expiringCoupons));
    
    if (!mapInstanceRef.current || !window.google) {
      console.log('Early return: no map instance or google maps');
      return;
    }

    // Clear existing markers (but keep explosion overlays)
    markersRef.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    markersRef.current = [];

    // Clean up completed explosions (remove overlays for coupons no longer in expiringCoupons)
    const currentExplosions = explosionOverlaysRef.current;
    Array.from(currentExplosions.entries()).forEach(([couponId, overlay]) => {
      if (!expiringCoupons.has(couponId)) {
        console.log(`🧹 Cleaning up completed explosion for coupon ${couponId}`);
        if (overlay && overlay.setMap) {
          overlay.setMap(null);
        }
        currentExplosions.delete(couponId);
      }
    });

    // Add coupon markers and explosion effects
    coupons.forEach((coupon, index) => {
      console.log(`Processing coupon ${index}: ${coupon.id}`);
      
      // Validate coupon location
      if (!coupon.location || typeof coupon.location.lat !== 'number' || typeof coupon.location.lng !== 'number') {
        console.warn(`Invalid location for coupon ${coupon.id}:`, coupon.location);
        return;
      }
      
      const isNearby = coupon.distance_meters !== undefined && coupon.distance_meters <= 300;
      
      // Get appropriate color and emoji for coupon source
      let markerColor = '#ff4444'; // 内部クーポン (赤色・🛍️)
      let markerEmoji = '🛍️';
      let sourceType = 'internal'; // デフォルト
      
      // クーポンIDからソースを判定する場合も含める
      if (coupon.source === 'hotpepper' || coupon.id.startsWith('hotpepper_')) {
        markerColor = '#FF6600'; // Hot Pepperクーポン (オレンジ色・🍽️)
        markerEmoji = '🍽️';
        sourceType = 'hotpepper';
      } else if (coupon.source === 'kumapon' || coupon.id.startsWith('kumapon_')) {
        markerColor = '#4285F4'; // Kumaponクーポン (青色・🐻)
        markerEmoji = '🐻';
        sourceType = 'kumapon';
      } else if (coupon.source === 'yahoo' || coupon.id.startsWith('yahoo_')) {
        markerColor = '#FF0033'; // Yahoo地図クーポン (Yahoo赤色・🗺️)
        markerEmoji = '🗺️';
        sourceType = 'yahoo';
      } else if (coupon.source === 'external') {
        markerColor = '#4285F4';
        markerEmoji = '🌐';
        sourceType = 'external';
      }

      // Create marker with simplified icon first
      let markerIcon;
      const position = { lat: coupon.location.lat, lng: coupon.location.lng };
      
      try {
        // Try to create custom SVG icon (original coupon shape)
        const svgIcon = `
          <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
            <rect x="5" y="5" width="70" height="70" rx="16" fill="${markerColor}" stroke="white" stroke-width="3" stroke-dasharray="${isNearby ? '0' : '5,5'}"/>
            <text x="40" y="35" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">${markerEmoji}</text>
            <text x="40" y="55" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12" font-weight="bold">COUPON</text>
            <text x="40" y="68" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="10" font-weight="bold">${coupon.current_discount}%</text>
          </svg>
        `;
        
        markerIcon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
          scaledSize: new window.google.maps.Size(60, 60),
          anchor: new window.google.maps.Point(30, 55)
        };
      } catch (error) {
        console.warn('Failed to create custom SVG icon, using colored pin:', error);
        // Use default colored pin as fallback
        let pinColor = 'red';
        if (sourceType === 'hotpepper') {
          pinColor = 'orange';
        } else if (sourceType === 'yahoo') {
          pinColor = 'red';
        } else if (sourceType === 'kumapon' || sourceType === 'external') {
          pinColor = 'blue';
        }
        
        markerIcon = `https://maps.google.com/mapfiles/ms/icons/${pinColor}-dot.png`;
      }

      // Check if this coupon is expiring
      const isExpiring = expiringCoupons.has(coupon.id);
      
      if (isExpiring) {
        console.log(`🎆 Creating explosion effect for coupon ${coupon.id}`);
        
        // Check if explosion overlay already exists for this coupon
        if (explosionOverlaysRef.current.has(coupon.id)) {
          console.log(`⚡ Explosion already exists for coupon ${coupon.id}, skipping creation`);
          return;
        }
        
        // Skip creating any marker for expiring coupons - only create explosion effect
        const explosionOverlay = new window.google.maps.OverlayView();
        explosionOverlay.onAdd = function() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.transform = 'translate(-50%, -50%)';
          div.style.pointerEvents = 'none'; // マウスイベントを通さない
          
          // Mount React component
          const explosionRoot = document.createElement('div');
          div.appendChild(explosionRoot);
          
          // Use ReactDOM.render to mount the ExplosionEffect
          const root = createRoot(explosionRoot);
          const ExplosionComponent = React.createElement(ExplosionEffect, {
            onComplete: () => {
              console.log(`🎆 Explosion completed for coupon ${coupon.id}`);
              // 爆発完了時に即座にオーバーレイを削除
              explosionOverlay.setMap(null);
              // 爆発オーバーレイを管理マップから削除
              explosionOverlaysRef.current.delete(coupon.id);
              // その後、親コンポーネントに完了を通知
              onExplosionComplete(coupon.id);
            },
            useLottie: false,
            useWebM: true,
            isDebug: false
          });
          root.render(ExplosionComponent);
          
          this.getPanes()!.overlayMouseTarget.appendChild(div);
          this.div = div;
        };
        
        explosionOverlay.draw = function() {
          const projection = this.getProjection();
          const point = projection.fromLatLngToDivPixel(position);
          if (point && this.div) {
            this.div.style.left = point.x + 'px';
            this.div.style.top = point.y + 'px';
          }
        };
        
        explosionOverlay.onRemove = function() {
          if (this.div && this.div.parentNode) {
            this.div.parentNode.removeChild(this.div);
          }
        };
        
        explosionOverlay.setMap(mapInstanceRef.current);
        // 爆発オーバーレイを専用のマップで管理
        explosionOverlaysRef.current.set(coupon.id, explosionOverlay);
      } else {
        // Create normal marker
        try {
          const marker = new window.google.maps.Marker({
            position: position,
            map: mapInstanceRef.current,
            title: `${coupon.store_name || coupon.shop_name} - ${coupon.current_discount}% OFF`,
            icon: markerIcon,
            animation: isNearby ? window.google.maps.Animation.BOUNCE : undefined,
            optimized: false // For custom SVG icons
          });

          console.log(`✅ Marker created for coupon ${coupon.id} at (${position.lat}, ${position.lng})`);

          marker.addListener('click', () => {
            console.log(`Marker clicked for coupon: ${coupon.id}`);
            onCouponClick(coupon);
          });

          markersRef.current.push(marker);
        } catch (error) {
          console.error(`Failed to create marker for coupon ${coupon.id}:`, error);
        }
      }
    });

    
    console.log(`✅ Total markers created: ${markersRef.current.length}`);
    console.log('🔄 Markers updated (map view unchanged)');

  }, [coupons, onCouponClick, expiringCoupons, onExplosionComplete]);

  const updateUserMarker = useCallback(() => {
    if (!mapInstanceRef.current || !userLocation || !window.google) {
      return;
    }

    // Remove existing user marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
    }

    // Create new user marker
    const userMarker = new window.google.maps.Marker({
      position: { lat: userLocation.lat, lng: userLocation.lng },
      map: mapInstanceRef.current,
      title: 'あなたの現在位置',
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#4285F4" stroke="white" stroke-width="3"/>
            <circle cx="12" cy="12" r="4" fill="white"/>
            <circle cx="12" cy="12" r="2" fill="#4285F4"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(24, 24),
        anchor: new window.google.maps.Point(12, 12)
      },
      zIndex: 1000
    });

    userMarkerRef.current = userMarker;
    console.log('✅ User marker updated at:', userLocation);
  }, [userLocation]);

  const initializeMap = useCallback(() => {
    console.log('🗺️ initializeMap called');
    console.log('userLocation:', !!userLocation);
    console.log('mapRef.current:', !!mapRef.current);
    console.log('window.google:', !!window.google);
    console.log('isMapInitialized:', isMapInitializedRef.current);
    
    if (!userLocation || !mapRef.current || !window.google) {
      console.log('❌ initializeMap early return - missing dependencies');
      return;
    }

    // マップが既に初期化されている場合は、ユーザーマーカーのみ更新
    if (isMapInitializedRef.current && mapInstanceRef.current) {
      console.log('🔄 Map already initialized, updating user marker only');
      updateUserMarker();
      return;
    }

    console.log('✅ Creating Google Map instance...');
    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: userLocation.lat, lng: userLocation.lng },
        zoom: 15,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });

      mapInstanceRef.current = map;
      isMapInitializedRef.current = true;
      console.log('✅ Google Map instance created and stored');
      
      // Add user marker
      updateUserMarker();
      
      // 高速化：即座にマーカーを更新
      console.log('🔄 Triggering marker update after map initialization');
      updateMarkers();
      
    } catch (error) {
      console.error('❌ Failed to initialize Google Map:', error);
    }
  }, [userLocation, updateMarkers, updateUserMarker]);

  // Google Maps API の初期化（最初の一回のみ）
  useEffect(() => {
    // Google Maps APIキーのフォールバック - デモ用のAPIキーを使用
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyBFw0Qbyq9zTFTd-tUY6dpoWq2PVG7gA_M';
    
    if (!window.google && !document.querySelector('script[src*="maps.googleapis.com"]')) {
      console.log('🔄 Loading Google Maps API...');
      const script = document.createElement('script');
      // 高速化：librariesを最小限に、v=weeklyで最新版を使用
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=initMap&v=weekly`;
      script.async = true;
      script.defer = true;
      
      // タイムアウト処理を追加（時間延長）
      const timeoutId = setTimeout(() => {
        console.warn('⚠️ Google Maps API loading timeout');
      }, 10000);
      
      script.onload = () => {
        clearTimeout(timeoutId);
        console.log('✅ Google Maps API loaded successfully');
      };
      
      script.onerror = () => {
        clearTimeout(timeoutId);
        console.error('❌ Google Maps API failed to load. Please check your API key.');
      };
      
      document.head.appendChild(script);
      
      window.initMap = () => {
        clearTimeout(timeoutId);
        console.log('✅ Google Maps callback triggered');
        // 即座に初期化を試行（userLocationとmapRefの状態に関係なく）
        const checkAndInit = () => {
          console.log('🔄 Checking map initialization conditions after API load');
          console.log('- userLocation:', !!userLocation, userLocation);
          console.log('- mapRef.current:', !!mapRef.current);
          console.log('- isMapInitialized:', isMapInitializedRef.current);
          
          if (userLocation && mapRef.current) {
            console.log('✅ All conditions met, initializing map from callback');
            initializeMap();
          } else {
            console.log('⏳ Conditions not met, retrying in 100ms');
            setTimeout(checkAndInit, 100);
          }
        };
        
        setTimeout(checkAndInit, 50);
      };
    } else if (window.google && userLocation && mapRef.current) {
      // Google Maps APIが既に読み込まれている場合は即座に初期化
      console.log('🔄 Google Maps API already loaded, initializing immediately');
      initializeMap();
    }
  }, []); // 依存配列を空にして初回のみ実行

  // マップの初期化（userLocationが利用可能になったとき）
  useEffect(() => {
    if (window.google && userLocation && mapRef.current) {
      console.log('✅ Google Maps ready, initializing/updating map');
      initializeMap();
    } else {
      console.log('⏳ Map initialization conditions not met:', {
        googleMaps: !!window.google,
        userLocation: !!userLocation,
        mapRef: !!mapRef.current
      });
    }
  }, [userLocation, initializeMap]);

  // 追加：mapRefが利用可能になった時の追加チェック
  useEffect(() => {
    if (mapRef.current && window.google && userLocation && !isMapInitializedRef.current) {
      console.log('🔄 MapRef ready, checking if map needs initialization');
      setTimeout(() => {
        if (mapRef.current && window.google && userLocation && !isMapInitializedRef.current) {
          console.log('✅ Force initializing map due to mapRef availability');
          initializeMap();
        }
      }, 200);
    }
  }, [userLocation, initializeMap]);

  // 最終的なフォールバック：定期的に初期化状況をチェック
  useEffect(() => {
    if (!isMapInitializedRef.current) {
      console.log('🔄 Setting up periodic initialization check');
      const interval = setInterval(() => {
        if (window.google && userLocation && mapRef.current && !isMapInitializedRef.current) {
          console.log('🔄 Periodic check: attempting map initialization');
          initializeMap();
        }
      }, 1000);

      // 30秒後にクリーンアップ（初期化が完了しているか、諦める）- 時間を延長
      const timeout = setTimeout(() => {
        console.log('⏰ Stopping periodic initialization check after 30 seconds');
        clearInterval(interval);
      }, 30000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [userLocation, initializeMap]);

  // コンポーネントマウント後の即座チェック
  useEffect(() => {
    const immediateCheck = () => {
      console.log('🔄 Immediate post-mount check for map initialization');
      console.log('- window.google:', !!window.google);
      console.log('- userLocation:', !!userLocation);
      console.log('- mapRef.current:', !!mapRef.current);
      console.log('- isMapInitialized:', isMapInitializedRef.current);
      
      if (window.google && userLocation && mapRef.current && !isMapInitializedRef.current) {
        console.log('✅ All conditions met on immediate check, initializing map');
        initializeMap();
      }
    };

    // 遅延時間を大幅に延長し、より多くの再試行を追加（レンダリングとAPI読み込み完了を待つ）
    const timeouts = [50, 200, 500, 1000, 2000, 3000, 5000, 7000].map(delay => 
      setTimeout(immediateCheck, delay)
    );

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [initializeMap, userLocation]);  // initializeMapとuserLocationを依存配列に追加

  // クーポンデータの更新時のみマーカーを更新
  useEffect(() => {
    console.log('🔄 useEffect for updateMarkers triggered');
    console.log('mapInstanceRef.current exists:', !!mapInstanceRef.current);
    console.log('coupons count:', coupons.length);
    
    if (mapInstanceRef.current && window.google) {
      console.log('✅ Calling updateMarkers...');
      // 高速化：遅延なしで即座に更新
      updateMarkers();
    } else {
      console.log('⏳ updateMarkers not called - waiting for map instance');
      console.log('- Map instance:', !!mapInstanceRef.current);
      console.log('- Google Maps:', !!window.google);
    }
  }, [coupons, updateMarkers]);

  if (error) {
    return (
      <div className="map-error">
        <p>{error}</p>
      </div>
    );
  }

  // 位置情報がない場合は簡潔に表示（すぐにデフォルト位置が設定される）
  if (!userLocation) {
    return (
      <div className="map-loading">
        <div className="loading-spinner">📍</div>
        <p>マップを準備中...</p>
      </div>
    );
  }

  // Google Maps APIが読み込まれていない場合は簡潔な表示
  if (!window.google) {
    return (
      <div className="map-loading">
        <div className="loading-spinner">🗺️</div>
        <p>マップを準備中...</p>
      </div>
    );
  }

  return (
    <div className="map-view" style={{ position: 'relative' }}>
      <div 
        ref={(ref) => {
          mapRef.current = ref;
          // mapRefが設定された瞬間に初期化をチェック
          if (ref && window.google && userLocation && !isMapInitializedRef.current) {
            console.log('🔄 MapRef just set, checking initialization immediately');
            setTimeout(() => {
              if (window.google && userLocation && !isMapInitializedRef.current) {
                console.log('✅ Initializing map from ref callback');
                initializeMap();
              }
            }, 10);
          }
        }}
        className="map-container" 
        style={{ width: '100%', height: '100%' }} 
      />
      

      {/* 爆発エフェクト */}
      {showExplosion && (
        <ExplosionEffect 
          onComplete={() => setShowExplosion(false)} 
          useLottie={false}
          useWebM={true}
          isDebug={true}
        />
      )}
    </div>
  );
};

export default MapView;
import React, { useEffect, useRef, useCallback } from 'react';
import { Coupon, Location } from '../types';

interface MapViewProps {
  userLocation: Location | null;
  coupons: Coupon[];
  onCouponClick: (coupon: Coupon) => void;
  error: string | null;
}

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const MapView: React.FC<MapViewProps> = ({ userLocation, coupons, onCouponClick, error }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

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
    
    if (!mapInstanceRef.current || !window.google) {
      console.log('Early return: no map instance or google maps');
      return;
    }

    // Clear existing markers
    markersRef.current.forEach(marker => {
      if (marker && marker.setMap) {
        marker.setMap(null);
      }
    });
    markersRef.current = [];

    // Add coupon markers
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
        } else if (sourceType === 'kumapon' || sourceType === 'external') {
          pinColor = 'blue';
        }
        
        markerIcon = `https://maps.google.com/mapfiles/ms/icons/${pinColor}-dot.png`;
      }

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
    });
    
    console.log(`✅ Total markers created: ${markersRef.current.length}`);
    
    // Center map if there are markers and no user interaction yet
    if (markersRef.current.length > 0 && userLocation) {
      try {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(new window.google.maps.LatLng(userLocation.lat, userLocation.lng));
        markersRef.current.forEach(marker => {
          bounds.extend(marker.getPosition());
        });
        mapInstanceRef.current.fitBounds(bounds);
        
        // Set maximum zoom level
        window.google.maps.event.addListenerOnce(mapInstanceRef.current, 'bounds_changed', () => {
          if (mapInstanceRef.current.getZoom() > 16) {
            mapInstanceRef.current.setZoom(16);
          }
        });
      } catch (error) {
        console.warn('Failed to fit bounds:', error);
      }
    }
  }, [coupons, onCouponClick, userLocation]);

  const initializeMap = useCallback(() => {
    console.log('🗺️ initializeMap called');
    console.log('userLocation:', !!userLocation);
    console.log('mapRef.current:', !!mapRef.current);
    console.log('window.google:', !!window.google);
    
    if (!userLocation || !mapRef.current || !window.google) {
      console.log('❌ initializeMap early return - missing dependencies');
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

      // Add user location marker
      const userMarker = new window.google.maps.Marker({
        position: { lat: userLocation.lat, lng: userLocation.lng },
        map: map,
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

      console.log('✅ User marker created at:', userLocation);

      mapInstanceRef.current = map;
      console.log('✅ Google Map instance created and stored');
      
      // Trigger marker update after map is ready
      setTimeout(() => {
        console.log('🔄 Triggering marker update after map initialization');
        updateMarkers();
      }, 100);
      
    } catch (error) {
      console.error('❌ Failed to initialize Google Map:', error);
    }
  }, [userLocation, updateMarkers]);

  useEffect(() => {
    // Google Maps APIキーのフォールバック - デモ用のAPIキーを使用
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyBFw0Qbyq9zTFTd-tUY6dpoWq2PVG7gA_M';
    
    if (!window.google && !document.querySelector('script[src*="maps.googleapis.com"]')) {
      console.log('🔄 Loading Google Maps API...');
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=initMap`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.error('❌ Google Maps API failed to load. Please check your API key.');
      };
      document.head.appendChild(script);
      
      window.initMap = () => {
        console.log('✅ Google Maps callback triggered');
        if (userLocation && mapRef.current) {
          initializeMap();
        }
      };
    } else if (window.google && userLocation && mapRef.current) {
      console.log('✅ Google Maps already loaded, initializing map');
      initializeMap();
    }
  }, [userLocation, initializeMap]);

  useEffect(() => {
    console.log('🔄 useEffect for updateMarkers triggered');
    console.log('mapInstanceRef.current exists:', !!mapInstanceRef.current);
    console.log('userLocation exists:', !!userLocation);
    console.log('coupons count:', coupons.length);
    
    if (mapInstanceRef.current && userLocation && window.google) {
      console.log('✅ Calling updateMarkers...');
      // Small delay to ensure map is fully ready
      setTimeout(() => {
        updateMarkers();
      }, 50);
    } else {
      console.log('⏳ updateMarkers not called - waiting for prerequisites');
      console.log('- Map instance:', !!mapInstanceRef.current);
      console.log('- User location:', !!userLocation);
      console.log('- Google Maps:', !!window.google);
      console.log('- Coupons:', coupons.length);
    }
  }, [coupons, updateMarkers, userLocation]);

  if (error) {
    return (
      <div className="map-error">
        <p>{error}</p>
      </div>
    );
  }

  if (!userLocation) {
    return (
      <div className="map-loading">
        <div className="loading-spinner">📍</div>
        <p>位置情報を取得中...</p>
      </div>
    );
  }

  // Google Maps APIが読み込まれていない場合のローディング表示
  if (!window.google) {
    return (
      <div className="map-loading">
        <div className="loading-spinner">🗺️</div>
        <p>マップを読み込み中...</p>
        <small>少々お待ちください</small>
      </div>
    );
  }

  return (
    <div className="map-view">
      <div ref={mapRef} className="map-container" style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default MapView;
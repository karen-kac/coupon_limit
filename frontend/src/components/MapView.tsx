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
    console.log('mapInstanceRef.current:', mapInstanceRef.current);
    console.log('window.google:', window.google);
    console.log('coupons to process:', coupons);
    
    if (!mapInstanceRef.current || !window.google) {
      console.log('Early return: no map instance or google maps');
      return;
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add coupon markers
    coupons.forEach((coupon, index) => {
      console.log(`Processing coupon ${index}:`, coupon);
      const isNearby = coupon.distance_meters !== undefined && coupon.distance_meters <= 300;
      
      console.log(`Creating marker for coupon at lat: ${coupon.location.lat}, lng: ${coupon.location.lng}`);
      
      const marker = new window.google.maps.Marker({
        position: { lat: coupon.location.lat, lng: coupon.location.lng },
        map: mapInstanceRef.current,
                  title: coupon.store_name || coupon.shop_name, // shop_name または store_name に対応
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="1000" height="1000" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="70" height="70" rx="16" fill="#ff4444" stroke="white" stroke-width="4" stroke-dasharray="${isNearby ? '0' : '5,5'}"/>
              <text x="40" y="35" text-anchor="middle" fill="white" font-family="Arial" font-size="24" font-weight="bold">🛍️</text>
              <text x="40" y="55" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">COUPON</text>
              <text x="40" y="70" text-anchor="middle" fill="white" font-family="Arial" font-size="12">${coupon.current_discount}%</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(80, 80),
          anchor: new window.google.maps.Point(40, 75)
        },
        animation: isNearby ? window.google.maps.Animation.BOUNCE : undefined
      });

      marker.addListener('click', () => {
        onCouponClick(coupon);
      });

      markersRef.current.push(marker);
    });
  }, [coupons, onCouponClick]);

  const initializeMap = useCallback(() => {
    if (!userLocation || !mapRef.current || !window.google) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: userLocation.lat, lng: userLocation.lng },
      zoom: 16,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    // Add user location marker
    new window.google.maps.Marker({
      position: { lat: userLocation.lat, lng: userLocation.lng },
      map: map,
      title: 'Your Location',
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="8" fill="#4285F4" stroke="white" stroke-width="2"/>
            <circle cx="10" cy="10" r="3" fill="white"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(20, 20),
        anchor: new window.google.maps.Point(10, 10)
      }
    });

    mapInstanceRef.current = map;
  }, [userLocation]);

  useEffect(() => {
    // Google Maps APIキーのフォールバック
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE';
    
    if (!window.google && !document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=initMap`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.error('Google Maps API failed to load. Please check your API key.');
      };
      document.head.appendChild(script);
      
      window.initMap = () => {
        if (userLocation && mapRef.current) {
          initializeMap();
        }
      };
    } else if (window.google && userLocation && mapRef.current) {
      initializeMap();
    }
  }, [userLocation, initializeMap]);

  useEffect(() => {
    if (mapInstanceRef.current && userLocation) {
      updateMarkers();
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

  // Google Maps APIが利用できない場合の代替表示
  if (!window.google && !process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="map-fallback" style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
        <h3>マップ表示</h3>
        <p>現在位置: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}</p>
        <p>周辺のクーポン: {coupons.length}件</p>
        {coupons.length > 0 && (
          <div style={{ marginTop: '20px', maxHeight: '200px', overflowY: 'auto', width: '100%' }}>
            {coupons.map(coupon => (
              <div 
                key={coupon.id} 
                onClick={() => onCouponClick(coupon)}
                style={{ 
                  padding: '10px', 
                  margin: '5px 0', 
                  backgroundColor: 'white', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <strong>{coupon.store_name || coupon.shop_name}</strong>
                <br />
                <span>{coupon.title} - {coupon.current_discount}% OFF</span>
                {coupon.distance_meters && (
                  <>
                    <br />
                    <small>{Math.round(coupon.distance_meters)}m</small>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <small style={{ marginTop: '16px', color: '#666' }}>
          Google Maps APIを設定すると詳細なマップが表示されます
        </small>
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
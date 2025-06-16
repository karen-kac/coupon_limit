import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!window.google && !document.querySelector('script[src*="maps.googleapis.com"]')) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}&callback=initMap`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      
      window.initMap = () => {
        if (userLocation && mapRef.current) {
          initializeMap();
        }
      };
    } else if (window.google && userLocation && mapRef.current) {
      initializeMap();
    }
  }, [userLocation]);

  useEffect(() => {
    if (mapInstanceRef.current && userLocation) {
      updateMarkers();
    }
  }, [coupons]);

  const initializeMap = () => {
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
    updateMarkers();
  };

  const updateMarkers = () => {
    if (!mapInstanceRef.current || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add coupon markers
    coupons.forEach(coupon => {
      const isNearby = coupon.distance_meters !== undefined && coupon.distance_meters <= 20;
      
      const marker = new window.google.maps.Marker({
        position: { lat: coupon.location.lat, lng: coupon.location.lng },
        map: mapInstanceRef.current,
        title: coupon.shop_name,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="50" height="50" rx="12" fill="#ff4444" stroke="white" stroke-width="3" stroke-dasharray="${isNearby ? '0' : '5,5'}"/>
              <text x="30" y="25" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">🛍️</text>
              <text x="30" y="40" text-anchor="middle" fill="white" font-family="Arial" font-size="10" font-weight="bold">COUPON</text>
              <text x="30" y="50" text-anchor="middle" fill="white" font-family="Arial" font-size="8">${coupon.current_discount}%</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(60, 60),
          anchor: new window.google.maps.Point(30, 55)
        },
        animation: isNearby ? window.google.maps.Animation.BOUNCE : undefined
      });

      marker.addListener('click', () => {
        onCouponClick(coupon);
      });

      markersRef.current.push(marker);
    });
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

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

  return (
    <div className="map-view">
      <div ref={mapRef} className="map-container" style={{ width: '100%', height: '100%' }} />
      <div className="map-info">
        <p>🎯 周辺のクーポン: {coupons.length}件</p>
        {coupons.some(c => c.distance_meters !== undefined && c.distance_meters <= 20) && (
          <p>✨ 取得可能なクーポンがあります！</p>
        )}
      </div>
    </div>
  );
};

export default MapView;
#!/usr/bin/env python3
"""
Test script for Kumapon API integration
"""
import asyncio
import sys
import os

# Add the backend directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from external_coupons import ExternalCouponService

async def test_kumapon_api():
    """Test the Kumapon API integration"""
    service = ExternalCouponService()
    
    print("🧪 Testing Kumapon API Integration")
    print("=" * 50)
    
    # Test fetching areas
    print("1️⃣ Testing area groups API...")
    areas = await service.fetch_kumapon_areas()
    print(f"   Found {len(areas)} area groups")
    if areas:
        for i, area in enumerate(areas[:3]):  # Show first 3
            print(f"   - Area {i+1}: {area.get('name', area.get('id', 'Unknown'))}")
            print(f"     Keys: {list(area.keys()) if isinstance(area, dict) else type(area)}")
            if isinstance(area, dict) and 'deals' in area:
                print(f"     Has {len(area['deals'])} deals")
    
    # Test fetching coupons near Tokyo Station
    print("\n2️⃣ Testing location-based coupon search (Tokyo Station)...")
    tokyo_lat, tokyo_lng = 35.6812, 139.7671
    coupons = await service.fetch_kumapon_coupons_near_location(tokyo_lat, tokyo_lng, 5000)
    print(f"   Found {len(coupons)} coupons near Tokyo Station")
    
    for i, coupon in enumerate(coupons[:5]):  # Show first 5
        print(f"   - Coupon {i+1}: {coupon['title']} ({coupon['current_discount']}% OFF)")
        print(f"     Store: {coupon['store_name']}")
        print(f"     Distance: {coupon['distance_meters']:.1f}m")
        print(f"     URL: {coupon['external_url']}")
    
    # Test area mapping
    print("\n3️⃣ Testing area mapping...")
    area_ids = service.get_area_mapping_for_location(tokyo_lat, tokyo_lng)
    print(f"   Tokyo area IDs: {area_ids}")
    
    # Test Osaka location
    osaka_lat, osaka_lng = 34.6937, 135.5023
    osaka_area_ids = service.get_area_mapping_for_location(osaka_lat, osaka_lng)
    print(f"   Osaka area IDs: {osaka_area_ids}")
    
    print("\n✅ Test completed!")

if __name__ == "__main__":
    asyncio.run(test_kumapon_api())
import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8001/api"
TOKYO_STATION_LAT = 35.6812
TOKYO_STATION_LNG = 139.7671

# Test data
test_user = {
    "name": "Test User",
    "email": "user@test.com",
    "password": "password123"
}

admin_login = {
    "email": "store@example.com",
    "password": "password123"
}

# Test results
test_results = {}
user_token = None
admin_token = None
created_coupon_id = None

def print_test_header(test_name):
    print(f"\n{'=' * 80}")
    print(f"TEST: {test_name}")
    print(f"{'=' * 80}")

def print_response(response):
    print(f"Status Code: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text}")

def run_test(test_name, endpoint, method="GET", data=None, headers=None, params=None, expected_status=200):
    print_test_header(test_name)
    
    url = f"{BASE_URL}{endpoint}"
    print(f"URL: {url}")
    
    if method == "GET":
        response = requests.get(url, headers=headers, params=params)
    elif method == "POST":
        response = requests.post(url, json=data, headers=headers, params=params)
    elif method == "PUT":
        response = requests.put(url, json=data, headers=headers)
    elif method == "DELETE":
        response = requests.delete(url, headers=headers)
    
    print_response(response)
    
    success = response.status_code == expected_status
    test_results[test_name] = success
    
    if not success:
        print(f"❌ Test failed! Expected status {expected_status}, got {response.status_code}")
    else:
        print(f"✅ Test passed!")
    
    return response

def test_health_check():
    return run_test(
        "Health Check",
        "/health",
        method="GET",
        expected_status=200
    )

def test_user_registration():
    global user_token
    response = run_test(
        "User Registration",
        "/auth/register",
        method="POST",
        data=test_user,
        expected_status=200
    )
    
    if response.status_code == 200:
        user_token = response.json().get("access_token")
        print(f"User token: {user_token}")
    
    return response

def test_user_login():
    global user_token
    response = run_test(
        "User Login",
        "/auth/login",
        method="POST",
        data={
            "email": test_user["email"],
            "password": test_user["password"]
        },
        expected_status=200
    )
    
    if response.status_code == 200:
        user_token = response.json().get("access_token")
        print(f"User token: {user_token}")
    
    return response

def test_protected_route():
    if not user_token:
        print("❌ Cannot test protected route without user token")
        test_results["Protected Route"] = False
        return None
    
    return run_test(
        "Protected Route",
        "/auth/me",
        method="GET",
        headers={"Authorization": f"Bearer {user_token}"},
        expected_status=200
    )

def test_admin_login():
    global admin_token
    response = run_test(
        "Admin Login",
        "/auth/admin/login",
        method="POST",
        data=admin_login,
        expected_status=200
    )
    
    if response.status_code == 200:
        admin_token = response.json().get("access_token")
        print(f"Admin token: {admin_token}")
    
    return response

def test_get_coupons_unauthenticated():
    return run_test(
        "Get Coupons (Unauthenticated)",
        "/coupons",
        method="GET",
        params={
            "lat": TOKYO_STATION_LAT,
            "lng": TOKYO_STATION_LNG,
            "radius": 1000
        },
        expected_status=200
    )

def test_get_coupons_authenticated():
    if not user_token:
        print("❌ Cannot test authenticated coupons without user token")
        test_results["Get Coupons (Authenticated)"] = False
        return None
    
    return run_test(
        "Get Coupons (Authenticated)",
        "/coupons",
        method="GET",
        headers={"Authorization": f"Bearer {user_token}"},
        params={
            "lat": TOKYO_STATION_LAT,
            "lng": TOKYO_STATION_LNG,
            "radius": 1000
        },
        expected_status=200
    )

def test_get_user_coupons():
    if not user_token:
        print("❌ Cannot test user coupons without user token")
        test_results["Get User Coupons"] = False
        return None
    
    return run_test(
        "Get User Coupons",
        "/user/coupons",
        method="GET",
        headers={"Authorization": f"Bearer {user_token}"},
        expected_status=200
    )

def test_coupon_acquisition():
    global created_coupon_id
    
    if not user_token:
        print("❌ Cannot test coupon acquisition without user token")
        test_results["Coupon Acquisition"] = False
        return None
    
    # First, get available coupons
    coupons_response = requests.get(
        f"{BASE_URL}/coupons",
        params={
            "lat": TOKYO_STATION_LAT,
            "lng": TOKYO_STATION_LNG,
            "radius": 1000
        }
    )
    
    if coupons_response.status_code != 200 or not coupons_response.json():
        print("❌ No coupons available for acquisition test")
        test_results["Coupon Acquisition"] = False
        return None
    
    # Get the first coupon ID
    coupon_id = coupons_response.json()[0]["id"]
    
    return run_test(
        "Coupon Acquisition",
        "/coupons/get",
        method="POST",
        headers={"Authorization": f"Bearer {user_token}"},
        data={
            "coupon_id": coupon_id,
            "user_location": {
                "lat": TOKYO_STATION_LAT,
                "lng": TOKYO_STATION_LNG
            }
        },
        expected_status=200
    )

def test_admin_stats():
    if not admin_token:
        print("❌ Cannot test admin stats without admin token")
        test_results["Admin Stats"] = False
        return None
    
    return run_test(
        "Admin Stats",
        "/admin/stats",
        method="GET",
        headers={"Authorization": f"Bearer {admin_token}"},
        expected_status=200
    )

def test_store_creation():
    if not admin_token:
        print("❌ Cannot test store creation without admin token")
        test_results["Store Creation"] = False
        return None
    
    return run_test(
        "Store Creation",
        "/stores",
        method="POST",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={
            "name": "Test Store",
            "description": "A test store created by automated tests",
            "latitude": 35.6820,
            "longitude": 139.7680,
            "address": "Near Tokyo Station"
        },
        expected_status=200
    )

def test_store_coupon_creation():
    if not admin_token:
        print("❌ Cannot test store coupon creation without admin token")
        test_results["Store Coupon Creation"] = False
        return None
    
    # Current time in ISO format
    now = datetime.now().isoformat()
    
    return run_test(
        "Store Coupon Creation",
        "/store/coupons",
        method="POST",
        headers={"Authorization": f"Bearer {admin_token}"},
        data={
            "title": "Test Coupon",
            "description": "A test coupon created by automated tests",
            "discount_rate_initial": 25,
            "discount_rate_schedule": [
                {"time_remain_min": 60, "rate": 30},
                {"time_remain_min": 30, "rate": 40},
                {"time_remain_min": 10, "rate": 50}
            ],
            "start_time": now,
            "end_time": (datetime.now().timestamp() + 3600 * 2) * 1000  # 2 hours from now
        },
        expected_status=200
    )

def run_all_tests():
    print("\n\n🚀 Starting Backend API Tests\n")
    
    # Phase 1: Authentication & User Management
    test_health_check()
    test_user_registration()
    test_user_login()
    test_protected_route()
    test_admin_login()
    
    # Phase 2: Enhanced Coupon System
    test_get_coupons_unauthenticated()
    test_get_coupons_authenticated()
    test_get_user_coupons()
    test_coupon_acquisition()
    
    # Phase 3: Store Management
    test_admin_stats()
    test_store_creation()
    test_store_coupon_creation()
    
    # Print summary
    print("\n\n📊 Test Results Summary\n")
    for test_name, result in test_results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    passed = sum(1 for result in test_results.values() if result)
    total = len(test_results)
    print(f"\nOverall: {passed}/{total} tests passed ({passed/total*100:.1f}%)")

if __name__ == "__main__":
    run_all_tests()
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
import math
import uuid
import os
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Import new models and repositories
from models import get_db, User, Store, Coupon, UserCoupon, Admin
from repositories import (
    UserRepository, StoreRepository, EnhancedCouponRepository, 
    EnhancedUserCouponRepository, AdminRepository, GeoPointRepository,
    user_to_dict, store_to_dict, coupon_to_dict, user_coupon_to_dict
)
from auth import (
    create_access_token, get_current_user, get_current_admin, 
    get_current_user_optional, get_current_admin_optional, ACCESS_TOKEN_EXPIRE_MINUTES
)
# Import external coupons service
from external_coupons import ExternalCouponService, get_mock_external_coupons

# Import admin routes
from api.admin_routes import router as admin_router
# Import coupon routes
from api.coupon_routes import router as coupon_router

app = FastAPI(title="Enhanced Coupon Location API v2.0")

# Get the absolute path to the admin directory
current_dir = os.path.dirname(os.path.abspath(__file__))
admin_dir = os.path.join(os.path.dirname(current_dir), "admin")

# Mount static files for admin
app.mount("/static-admin", StaticFiles(directory=admin_dir), name="static-admin")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # 開発環境用
    allow_credentials=True,  # 認証トークンを使用するためTrueに設定
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include admin routes
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
# Include coupon routes
app.include_router(coupon_router, prefix="/api/coupons", tags=["coupons"])

# Pydantic models for requests/responses
class UserRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

class AdminRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str
    linked_store_id: Optional[str] = None
    registration_code: Optional[str] = None

class StoreCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    latitude: float
    longitude: float
    address: Optional[str] = None
    logo_url: Optional[str] = None

class CouponCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    discount_rate_initial: int
    discount_rate_schedule: Optional[List[dict]] = None  # [{"time_remain_min": 60, "rate": 20}]
    start_time: datetime
    end_time: datetime

class Location(BaseModel):
    lat: float
    lng: float

class GetCouponRequest(BaseModel):
    coupon_id: str
    user_location: Location

class CouponResponse(BaseModel):
    id: str
    store_name: str
    title: str
    description: Optional[str]
    current_discount: int
    location: Location
    expires_at: datetime
    time_remaining_minutes: int
    distance_meters: Optional[float] = None
    source: Optional[str] = "internal"  # "internal" or "external"
    external_url: Optional[str] = None  # External coupon URL

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: Optional[dict] = None
    admin: Optional[dict] = None

# Utility functions
def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points using Haversine formula"""
    R = 6371000  # Earth's radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)
    
    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) *
         math.sin(delta_lng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

# Authentication endpoints
@app.post("/api/auth/register", response_model=TokenResponse)
async def register_user(user_data: UserRegisterRequest, db: Session = Depends(get_db)):
    """Register a new user"""
    user_repo = UserRepository(db)
    
    # Check if user already exists
    if user_repo.get_user_by_email(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = user_repo.create_user({
        "name": user_data.name,
        "email": user_data.email,
        "password": user_data.password
    })
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "type": "user"}, 
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_dict(user)
    )

@app.post("/api/auth/login", response_model=TokenResponse)
async def login_user(user_data: UserLoginRequest, db: Session = Depends(get_db)):
    """Login user"""
    user_repo = UserRepository(db)
    
    user = user_repo.authenticate_user(user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "type": "user"}, 
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_dict(user)
    )

# Admin endpoints moved to admin_routes.py

# Admin registration moved to admin_routes.py

@app.get("/api/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return user_to_dict(current_user)

# Admin auth endpoints moved to admin_routes.py

@app.get("/api/auth/verify")
async def verify_token(
    current_user: Optional[User] = Depends(get_current_user_optional),
    current_admin: Optional[Admin] = Depends(get_current_admin_optional)
):
    """Verify if the token is valid"""
    if current_user:
        return {"valid": True, "user": user_to_dict(current_user)}
    elif current_admin:
        return {
            "valid": True, 
            "admin": {
                "id": str(current_admin.id),
                "email": current_admin.email,
                "role": current_admin.role,
                "linked_store_id": str(current_admin.linked_store_id) if current_admin.linked_store_id else None
            }
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid token")

# Store management endpoints
# Store creation endpoints moved to admin_routes.py

# Admin store endpoints moved to admin_routes.py

@app.get("/api/stores/public")
async def get_public_stores(db: Session = Depends(get_db)):
    """Get all active stores for public registration"""
    store_repo = StoreRepository(db)
    try:
        stores = store_repo.get_all_active_stores()
        return [{"id": store.id, "name": store.name} for store in stores]
    except Exception as e:
        # Return sample stores if database fails
        return [
            {"id": "1", "name": "東京駅コーヒーショップ"},
            {"id": "2", "name": "銀座レストラン"},
            {"id": "3", "name": "新宿書店"}
        ]

# Enhanced coupon endpoints
@app.get("/api/coupons")
async def get_coupons(
    lat: float, 
    lng: float, 
    radius: int = 1000, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[CouponResponse]:
    """Get all active coupons within radius"""
    try:
        print(f"Getting coupons for lat={lat}, lng={lng}, radius={radius}")
        coupon_repo = EnhancedCouponRepository(db)
        store_repo = StoreRepository(db)
        geo_repo = GeoPointRepository(db)
        
        # Track user location if authenticated
        try:
            geo_repo.add_location_point(current_user.id, lat, lng)
        except Exception as e:
            print(f"Failed to track location: {e}")
        
        # Get user's already obtained coupon IDs
        user_coupon_repo = EnhancedUserCouponRepository(db)
        user_obtained_coupons = db.query(UserCoupon.coupon_id).filter(
            UserCoupon.user_id == current_user.id
        ).all()
        obtained_coupon_ids = {str(coupon_id[0]) for coupon_id in user_obtained_coupons}
        print(f"User has already obtained {len(obtained_coupon_ids)} coupons: {obtained_coupon_ids}")
        
        user_location = Location(lat=lat, lng=lng)
        active_coupons = coupon_repo.get_active_coupons()
        print(f"Found {len(active_coupons)} active coupons")
        nearby_coupons = []
        
        for coupon in active_coupons:
            try:
                # Skip if user has already obtained this coupon
                if str(coupon.id) in obtained_coupon_ids:
                    print(f"Skipping already obtained coupon: {coupon.id}")
                    continue
                    
                print(f"Processing coupon: {coupon.id} for store: {coupon.store_id}")
                # Get store information
                store = store_repo.get_store_by_id(coupon.store_id)
                if not store:
                    print(f"Store not found for coupon {coupon.id}")
                    continue
                    
                distance = calculate_distance(
                    user_location.lat, user_location.lng,
                    store.latitude, store.longitude
                )
                
                print(f"Distance to store {store.name}: {distance}m (radius: {radius}m)")
                
                if distance <= radius:
                    # Calculate current discount
                    current_discount = coupon_repo.calculate_current_discount(coupon)
                    
                    # Update coupon current_discount if changed
                    if current_discount != coupon.current_discount:
                        coupon.current_discount = current_discount
                        db.commit()
                    
                    now = datetime.now()
                    
                    # Handle timezone-aware comparison
                    end_time = coupon.end_time
                    if end_time.tzinfo is not None:
                        end_time = end_time.replace(tzinfo=None)
                    if now.tzinfo is not None:
                        now = now.replace(tzinfo=None)
                    
                    time_remaining = end_time - now
                    minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
                    
                    nearby_coupons.append(CouponResponse(
                        id=str(coupon.id),
                        store_name=store.name,
                        title=coupon.title,
                        description=coupon.description,
                        current_discount=current_discount,
                        location=Location(lat=store.latitude, lng=store.longitude),
                        expires_at=end_time,
                        time_remaining_minutes=minutes_remaining,
                        distance_meters=distance,
                        source="internal"
                    ))
                    print(f"Added coupon {coupon.id} to nearby list")
            except Exception as e:
                print(f"Error processing coupon {coupon.id}: {e}")
                continue
        
        print(f"Found {len(nearby_coupons)} internal coupons")
        
        # Get external coupons and add them to the result
        try:
            external_service = ExternalCouponService()
            external_coupons = await external_service.get_external_coupons_near_location(lat, lng, radius)
            
            # If no real external coupons found, add some mock data for testing
            if not external_coupons:
                external_coupons = await get_mock_external_coupons(lat, lng, radius)
            
            for ext_coupon in external_coupons:
                # Skip if user has already obtained this external coupon
                if ext_coupon['id'] in obtained_coupon_ids:
                    print(f"Skipping already obtained external coupon: {ext_coupon['id']}")
                    continue
                    
                # Convert external coupon format to CouponResponse
                try:
                    expires_at = datetime.fromisoformat(ext_coupon['expires_at'].replace('Z', '+00:00'))
                except:
                    expires_at = ext_coupon['end_time']
                
                time_remaining = expires_at - datetime.now()
                minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
                
                nearby_coupons.append(CouponResponse(
                    id=ext_coupon['id'],
                    store_name=ext_coupon.get('shop_name', ext_coupon.get('store_name', '店舗名不明')),
                    title=ext_coupon['title'],
                    description=ext_coupon.get('description', ''),
                    current_discount=ext_coupon['current_discount'],
                    location=Location(
                        lat=ext_coupon['location']['lat'],
                        lng=ext_coupon['location']['lng']
                    ),
                    expires_at=expires_at,
                    time_remaining_minutes=minutes_remaining,
                    distance_meters=round(ext_coupon['distance_meters'], 1),
                    source=ext_coupon.get('source', 'external'),
                    external_url=ext_coupon.get('external_url')
                ))
                
            print(f"Added {len(external_coupons)} external coupons")
                
        except Exception as e:
            print(f"Failed to fetch external coupons: {e}")
        
        print(f"Returning {len(nearby_coupons)} total coupons (internal + external)")
        return nearby_coupons
        
    except Exception as e:
        import traceback
        print(f"Error in get_coupons: {e}")
        print(f"Traceback: {traceback.format_exc()}")
        # Return sample data if database fails
        return [
            CouponResponse(
                id="sample-1",
                store_name="サンプル店舗",
                title="サンプルクーポン",
                description="これはサンプルです",
                current_discount=20,
                location=Location(lat=lat, lng=lng),
                expires_at=datetime.now() + timedelta(hours=2),
                time_remaining_minutes=120,
                distance_meters=100.0
            )
        ]

# Coupon get endpoint moved to api/coupon_routes.py to avoid duplication

@app.get("/api/user/coupons")
async def get_user_coupons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[dict]:
    """Get all coupons for authenticated user"""
    user_coupon_repo = EnhancedUserCouponRepository(db)
    coupon_repo = EnhancedCouponRepository(db)
    store_repo = StoreRepository(db)
    
    user_coupons = user_coupon_repo.get_user_coupons(current_user.id)
    result = []
    
    for user_coupon in user_coupons:
        # Get coupon and store details
        coupon = coupon_repo.get_coupon_by_id(user_coupon.coupon_id)
        store = store_repo.get_store_by_id(coupon.store_id) if coupon else None
        
        user_coupon_dict = user_coupon_to_dict(user_coupon)
        if coupon and store:
            user_coupon_dict.update({
                "shop_name": store.name,
                "title": coupon.title,
                "discount": user_coupon.discount_at_obtain,
                # Legacy fields for frontend compatibility
                "is_used": user_coupon.status == "used",
                "used_at": user_coupon.used_at
            })
        
        result.append(user_coupon_dict)
    
    return result

@app.post("/api/user/coupons/{user_coupon_id}/use")
async def use_coupon(
    user_coupon_id: str, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a coupon as used"""
    user_coupon_repo = EnhancedUserCouponRepository(db)
    
    user_coupon = user_coupon_repo.use_coupon(user_coupon_id, current_user.id)
    
    if not user_coupon:
        raise HTTPException(status_code=404, detail="User coupon not found")
    
    if user_coupon.status != "used":
        raise HTTPException(status_code=400, detail="Failed to use coupon")
    
    return {"message": "Coupon used successfully"}

# Store owner coupon management
@app.post("/api/store/coupons")
async def create_store_coupon_legacy(
    coupon_data: CouponCreateRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a coupon for store owner's store (legacy endpoint)"""
    if current_admin.role != "store_owner" or not current_admin.linked_store_id:
        raise HTTPException(status_code=403, detail="Store owner access required")
    
    coupon_repo = EnhancedCouponRepository(db)
    
    coupon = coupon_repo.create_coupon({
        "store_id": current_admin.linked_store_id,
        "title": coupon_data.title,
        "description": coupon_data.description,
        "discount_rate_initial": coupon_data.discount_rate_initial,
        "discount_rate_schedule": coupon_data.discount_rate_schedule or [],
        "start_time": coupon_data.start_time,
        "end_time": coupon_data.end_time
    })
    
    return {"message": "Coupon created successfully", "coupon": coupon_to_dict(coupon)}

# Admin coupon creation moved to admin_routes.py

# Admin coupon get endpoints moved to admin_routes.py

# Legacy admin endpoints (backwards compatibility)
# Admin stats endpoint moved to admin_routes.py

# Old external-test endpoint removed - now handled by api/coupon_routes.py

@app.get("/api/coupons/simple-test")
async def simple_coupon_test():
    """Simple test endpoint without database dependency"""
    mock_coupons = [
        {
            "id": "test_tokyo_1",
            "shop_name": "東京駅周辺店舗",
            "title": "テスト用クーポン 40% OFF",
            "current_discount": 40,
            "location": {"lat": 35.6812, "lng": 139.7671},
            "expires_at": (datetime.now() + timedelta(hours=2)).isoformat(),
            "time_remaining_minutes": 120,
            "distance_meters": 100,
            "description": "これは動作確認用のテストクーポンです",
            "source": "external",
            "store_name": "東京駅周辺店舗"
        },
        {
            "id": "test_shibuya_1", 
            "shop_name": "渋谷テスト店",
            "title": "テスト用クーポン 30% OFF",
            "current_discount": 30,
            "location": {"lat": 35.6598, "lng": 139.7006},
            "expires_at": (datetime.now() + timedelta(hours=3)).isoformat(),
            "time_remaining_minutes": 180,
            "distance_meters": 500,
            "description": "これは動作確認用のテストクーポンです",
            "source": "external", 
            "store_name": "渋谷テスト店"
        }
    ]
    
    return {"external_coupons": mock_coupons, "count": len(mock_coupons)}

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now(), "version": "2.0"}

# Startup event - Create sample data for demo
@app.on_event("startup")
async def startup_event():
    """Initialize with sample data if database is empty"""
    from supabase_client import SessionLocal
    
    db = SessionLocal()
    user_repo = UserRepository(db)
    admin_repo = AdminRepository(db)
    store_repo = StoreRepository(db)
    coupon_repo = EnhancedCouponRepository(db)
    
    try:
        # Check if we already have data
        existing_stores = store_repo.get_all_stores()
        if len(existing_stores) > 0:
            return  # Already have data
        
        # Create sample admins/store owners for demo accounts
        demo_admins = [
            {
                "email": "coffee@example.com",
                "password": "store1123",
                "role": "store_owner"
            },
            {
                "email": "restaurant@example.com", 
                "password": "store2123",
                "role": "store_owner"
            },
            {
                "email": "bookstore@example.com",
                "password": "store3123", 
                "role": "store_owner"
            }
        ]
        
        created_admins = []
        for admin_data in demo_admins:
            admin = admin_repo.create_admin(admin_data)
            created_admins.append(admin)
        
        # Create sample stores
        sample_stores = [
            {
                "name": "東京駅コーヒーショップ",
                "description": "美味しいコーヒーと軽食を提供しています",
                "latitude": 35.6812,
                "longitude": 139.7671,
                "address": "東京駅周辺",
                "owner_email": "coffee@example.com"
            },
            {
                "name": "銀座レストラン",
                "description": "本格的な日本料理レストラン",
                "latitude": 35.6815,
                "longitude": 139.7675,
                "address": "銀座周辺",
                "owner_email": "restaurant@example.com"
            },
            {
                "name": "新宿書店",
                "description": "本と文房具の専門店",
                "latitude": 35.6810,
                "longitude": 139.7665,
                "address": "新宿周辺",
                "owner_email": "bookstore@example.com"
            }
        ]
        
        created_stores = []
        for store_data in sample_stores:
            store = store_repo.create_store(store_data)
            created_stores.append(store)
        
        # Link each admin to their respective store
        for i, admin in enumerate(created_admins):
            if i < len(created_stores):
                admin.linked_store_id = created_stores[i].id
        db.commit()
        
        # Create sample coupons
        now = datetime.now()
        sample_coupons = [
            {
                "store_id": created_stores[0].id,
                "title": "ドリンク全品",
                "description": "コーヒー、紅茶、ジュース全品対象",
                "discount_rate_initial": 15,
                "discount_rate_schedule": [
                    {"time_remain_min": 60, "rate": 20},
                    {"time_remain_min": 30, "rate": 30},
                    {"time_remain_min": 10, "rate": 40}
                ],
                "start_time": now,
                "end_time": now + timedelta(minutes=90)
            },
            {
                "store_id": created_stores[1].id,
                "title": "ランチメニュー",
                "description": "定食、丼物、麺類など",
                "discount_rate_initial": 20,
                "discount_rate_schedule": [
                    {"time_remain_min": 45, "rate": 25},
                    {"time_remain_min": 20, "rate": 35},
                    {"time_remain_min": 5, "rate": 50}
                ],
                "start_time": now,
                "end_time": now + timedelta(minutes=120)
            },
            {
                "store_id": created_stores[2].id,
                "title": "文房具",
                "description": "ペン、ノート、手帳類",
                "discount_rate_initial": 10,
                "discount_rate_schedule": [
                    {"time_remain_min": 60, "rate": 15},
                    {"time_remain_min": 30, "rate": 25}
                ],
                "start_time": now,
                "end_time": now + timedelta(minutes=180)
            }
        ]
        
        for coupon_data in sample_coupons:
            coupon_repo.create_coupon(coupon_data)
        
        print("Sample data created successfully!")
        
    except Exception as e:
        print(f"Error creating sample data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
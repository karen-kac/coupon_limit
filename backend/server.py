from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
import math
import uuid
from sqlalchemy.orm import Session

# Import new models and repositories
from models import get_db, User, Store, Coupon, UserCoupon, Admin
from repositories import (
    UserRepository, StoreRepository, EnhancedCouponRepository, 
    EnhancedUserCouponRepository, AdminRepository, GeoPointRepository,
    user_to_dict, store_to_dict, coupon_to_dict, user_coupon_to_dict
)
from auth import (
    create_access_token, get_current_user, get_current_admin, 
    get_current_user_optional, ACCESS_TOKEN_EXPIRE_MINUTES
)

app = FastAPI(title="Enhanced Coupon Location API v2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        data={"sub": user.id, "type": "user"}, 
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
        data={"sub": user.id, "type": "user"}, 
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_dict(user)
    )

@app.post("/api/auth/admin/login", response_model=TokenResponse)
async def login_admin(admin_data: AdminLoginRequest, db: Session = Depends(get_db)):
    """Login admin or store owner"""
    admin_repo = AdminRepository(db)
    
    admin = admin_repo.authenticate_admin(admin_data.email, admin_data.password)
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": admin.id, "type": "admin"}, 
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        admin={
            "id": admin.id,
            "email": admin.email,
            "role": admin.role,
            "linked_store_id": admin.linked_store_id
        }
    )

@app.get("/api/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return user_to_dict(current_user)

# Store management endpoints
@app.post("/api/stores")
async def create_store(
    store_data: StoreCreateRequest, 
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a new store (store owners and super admins only)"""
    if current_admin.role not in ["store_owner", "super_admin"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    store_repo = StoreRepository(db)
    
    # For store owners, use their email. For super admins, allow specifying
    owner_email = current_admin.email
    
    store = store_repo.create_store({
        "name": store_data.name,
        "description": store_data.description,
        "latitude": store_data.latitude,
        "longitude": store_data.longitude,
        "address": store_data.address,
        "logo_url": store_data.logo_url,
        "owner_email": owner_email
    })
    
    # Link store to admin if they're a store owner
    if current_admin.role == "store_owner" and not current_admin.linked_store_id:
        current_admin.linked_store_id = store.id
        db.commit()
    
    return {"message": "Store created successfully", "store": store_to_dict(store)}

@app.get("/api/stores/my")
async def get_my_stores(
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get stores owned by current admin"""
    store_repo = StoreRepository(db)
    stores = store_repo.get_stores_by_owner(current_admin.email)
    return [store_to_dict(store) for store in stores]

# Enhanced coupon endpoints
@app.get("/api/coupons")
async def get_coupons(
    lat: float, 
    lng: float, 
    radius: int = 1000, 
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
) -> List[CouponResponse]:
    """Get all active coupons within radius"""
    try:
        coupon_repo = EnhancedCouponRepository(db)
        store_repo = StoreRepository(db)
        geo_repo = GeoPointRepository(db)
        
        # Track user location if authenticated
        if current_user:
            try:
                geo_repo.add_location_point(current_user.id, lat, lng)
            except Exception as e:
                print(f"Failed to track location: {e}")
        
        user_location = Location(lat=lat, lng=lng)
        active_coupons = coupon_repo.get_active_coupons()
        nearby_coupons = []
        
        for coupon in active_coupons:
            try:
                # Get store information
                store = store_repo.get_store_by_id(coupon.store_id)
                if not store:
                    continue
                    
                distance = calculate_distance(
                    user_location.lat, user_location.lng,
                    store.latitude, store.longitude
                )
                
                if distance <= radius:
                    # Calculate current discount
                    current_discount = coupon_repo.calculate_current_discount(coupon)
                    
                    # Update coupon current_discount if changed
                    if current_discount != coupon.current_discount:
                        coupon.current_discount = current_discount
                        db.commit()
                    
                    now = datetime.now()
                    time_remaining = coupon.end_time - now
                    minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
                    
                    nearby_coupons.append(CouponResponse(
                        id=coupon.id,
                        store_name=store.name,
                        title=coupon.title,
                        description=coupon.description,
                        current_discount=current_discount,
                        location=Location(lat=store.latitude, lng=store.longitude),
                        expires_at=coupon.end_time,
                        time_remaining_minutes=minutes_remaining,
                        distance_meters=distance
                    ))
            except Exception as e:
                print(f"Error processing coupon {coupon.id}: {e}")
                continue
        
        return nearby_coupons
        
    except Exception as e:
        print(f"Error in get_coupons: {e}")
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

@app.post("/api/coupons/get")
async def get_coupon(
    request: GetCouponRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific coupon if user is within range"""
    coupon_repo = EnhancedCouponRepository(db)
    store_repo = StoreRepository(db)
    user_coupon_repo = EnhancedUserCouponRepository(db)
    
    # Find the coupon
    coupon = coupon_repo.get_coupon_by_id(request.coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    # Get store information
    store = store_repo.get_store_by_id(coupon.store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Check if user already has this coupon
    if user_coupon_repo.check_user_has_coupon(current_user.id, request.coupon_id):
        raise HTTPException(status_code=400, detail="Coupon already obtained")
    
    # Check distance (300 meters)
    distance = calculate_distance(
        request.user_location.lat, request.user_location.lng,
        store.latitude, store.longitude
    )
    
    if distance > 300:
        raise HTTPException(
            status_code=400, 
            detail=f"Too far from coupon location (distance: {distance:.1f}m)"
        )
    
    # Calculate current discount
    current_discount = coupon_repo.calculate_current_discount(coupon)
    
    # Create user coupon
    user_coupon = user_coupon_repo.create_user_coupon({
        "user_id": current_user.id,
        "coupon_id": coupon.id,
        "discount_at_obtain": current_discount
    })
    
    return {
        "message": "Coupon obtained successfully", 
        "coupon": user_coupon_to_dict(user_coupon)
    }

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

@app.post("/api/user/coupons/{coupon_id}/use")
async def use_coupon(
    coupon_id: str, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a coupon as used"""
    user_coupon_repo = EnhancedUserCouponRepository(db)
    
    user_coupon = user_coupon_repo.use_coupon(coupon_id, current_user.id)
    
    if not user_coupon:
        raise HTTPException(status_code=404, detail="User coupon not found")
    
    if user_coupon.status != "used":
        raise HTTPException(status_code=400, detail="Failed to use coupon")
    
    return {"message": "Coupon used successfully"}

# Store owner coupon management
@app.post("/api/store/coupons")
async def create_store_coupon(
    coupon_data: CouponCreateRequest,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Create a coupon for store owner's store"""
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

@app.get("/api/store/coupons")
async def get_store_coupons(
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all coupons for store owner's store"""
    if current_admin.role != "store_owner" or not current_admin.linked_store_id:
        raise HTTPException(status_code=403, detail="Store owner access required")
    
    coupon_repo = EnhancedCouponRepository(db)
    coupons = coupon_repo.get_coupons_by_store(current_admin.linked_store_id)
    
    return [coupon_to_dict(coupon) for coupon in coupons]

# Legacy admin endpoints (backwards compatibility)
@app.get("/api/admin/stats")
async def get_admin_stats(
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get statistics for admin dashboard"""
    coupon_repo = EnhancedCouponRepository(db)
    user_coupon_repo = EnhancedUserCouponRepository(db)
    
    # Filter by store if store owner
    if current_admin.role == "store_owner" and current_admin.linked_store_id:
        all_coupons = coupon_repo.get_coupons_by_store(current_admin.linked_store_id)
    else:
        all_coupons = coupon_repo.get_active_coupons()
    
    now = datetime.now()
    active_coupons = [c for c in all_coupons if c.active_status == "active" and c.end_time > now]
    expired_coupons = [c for c in all_coupons if c.end_time <= now]
    
    # Get user coupon stats
    total_obtained = 0
    total_used = 0
    
    for coupon in all_coupons:
        coupon_users = db.query(UserCoupon).filter(UserCoupon.coupon_id == coupon.id).all()
        total_obtained += len(coupon_users)
        total_used += len([uc for uc in coupon_users if uc.status == "used"])
    
    return {
        "total_coupons": len(all_coupons),
        "active_coupons": len(active_coupons),
        "expired_coupons": len(expired_coupons),
        "total_obtained": total_obtained,
        "total_used": total_used,
        "overall_usage_rate": (total_used / total_obtained * 100) if total_obtained > 0 else 0.0
    }

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
        
        # Create sample admin/store owner
        sample_admin = admin_repo.create_admin({
            "email": "store@example.com",
            "password": "password123",
            "role": "store_owner"
        })
        
        # Create sample stores
        sample_stores = [
            {
                "name": "コーヒーショップ",
                "description": "美味しいコーヒーと軽食を提供しています",
                "latitude": 35.6812,
                "longitude": 139.7671,
                "address": "東京駅周辺",
                "owner_email": "store@example.com"
            },
            {
                "name": "レストラン",
                "description": "本格的な日本料理レストラン",
                "latitude": 35.6815,
                "longitude": 139.7675,
                "address": "東京駅周辺",
                "owner_email": "store@example.com"
            },
            {
                "name": "書店",
                "description": "本と文房具の専門店",
                "latitude": 35.6810,
                "longitude": 139.7665,
                "address": "東京駅周辺",
                "owner_email": "store@example.com"
            }
        ]
        
        created_stores = []
        for store_data in sample_stores:
            store = store_repo.create_store(store_data)
            created_stores.append(store)
        
        # Link first store to admin
        sample_admin.linked_store_id = created_stores[0].id
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
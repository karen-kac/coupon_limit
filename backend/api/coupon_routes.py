"""
Coupon-related API routes
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import math
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase_client import get_db
from models import User, Store, Coupon, UserCoupon
from auth import get_current_user

router = APIRouter()

# Pydantic models
class Location(BaseModel):
    lat: float
    lng: float

class CouponResponse(BaseModel):
    id: str
    shop_name: str
    title: str
    current_discount: int
    location: Location
    expires_at: datetime
    time_remaining_minutes: int
    distance_meters: Optional[float] = None
    description: Optional[str] = None

class GetCouponRequest(BaseModel):
    coupon_id: str
    user_location: Location
    user_id: Optional[str] = None  # Optional for authenticated users

class CouponStats(BaseModel):
    total_active: int
    near_user: int
    user_obtained: int

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

def update_coupon_discounts(db: Session):
    """Update coupon discounts based on time remaining"""
    now = datetime.now()
    active_coupons = db.query(Coupon).filter(
        Coupon.active_status == "active",
        Coupon.end_time > now
    ).all()
    
    for coupon in active_coupons:
        time_remaining = coupon.end_time - now
        minutes_remaining = time_remaining.total_seconds() / 60
        
        # Simple discount escalation logic
        if minutes_remaining <= 10:
            new_discount = min(50, coupon.discount_rate_initial + 30)
        elif minutes_remaining <= 30:
            new_discount = min(40, coupon.discount_rate_initial + 20)
        elif minutes_remaining <= 60:
            new_discount = min(30, coupon.discount_rate_initial + 10)
        else:
            new_discount = coupon.discount_rate_initial
        
        if coupon.current_discount != new_discount:
            coupon.current_discount = new_discount
    
    db.commit()

@router.get("/", response_model=List[CouponResponse])
async def get_nearby_coupons(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius: int = Query(1000, description="Search radius in meters"),
    db: Session = Depends(get_db)
):
    """Get coupons near the user's location"""
    
    # Update discount rates
    update_coupon_discounts(db)
    
    # Get active coupons with their stores
    active_coupons = db.query(Coupon, Store).join(
        Store, Coupon.store_id == Store.id
    ).filter(
        Coupon.active_status == "active",
        Coupon.end_time > datetime.now(),
        Store.is_active == True
    ).all()
    
    nearby_coupons = []
    
    for coupon, store in active_coupons:
        distance = calculate_distance(lat, lng, store.latitude, store.longitude)
        
        if distance <= radius:
            time_remaining = coupon.end_time - datetime.now()
            minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
            
            nearby_coupons.append(CouponResponse(
                id=coupon.id,
                shop_name=store.name,
                title=coupon.title,
                current_discount=coupon.current_discount,
                location=Location(lat=store.latitude, lng=store.longitude),
                expires_at=coupon.end_time,
                time_remaining_minutes=minutes_remaining,
                distance_meters=round(distance, 1),
                description=coupon.description
            ))
    
    # Sort by distance
    nearby_coupons.sort(key=lambda x: x.distance_meters or 0)
    
    return nearby_coupons

@router.post("/get")
async def obtain_coupon(
    request: GetCouponRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtain a coupon if user is within range"""
    
    # Update discount rates
    update_coupon_discounts(db)
    
    # Get coupon with store info
    coupon_data = db.query(Coupon, Store).join(
        Store, Coupon.store_id == Store.id
    ).filter(Coupon.id == request.coupon_id).first()
    
    if not coupon_data:
        raise HTTPException(status_code=404, detail="クーポンが見つかりません")
    
    coupon, store = coupon_data
    
    # Check if coupon is still active
    if coupon.active_status != "active" or coupon.end_time <= datetime.now():
        raise HTTPException(status_code=400, detail="このクーポンは既に期限切れです")
    
    # Check if user already has this coupon
    existing_user_coupon = db.query(UserCoupon).filter(
        UserCoupon.user_id == current_user.id,
        UserCoupon.coupon_id == request.coupon_id
    ).first()
    
    if existing_user_coupon:
        raise HTTPException(status_code=400, detail="このクーポンは既に取得済みです")
    
    # Check distance (20m radius for obtaining)
    distance = calculate_distance(
        request.user_location.lat, 
        request.user_location.lng,
        store.latitude, 
        store.longitude
    )
    
    if distance > 20:  # 20 meters
        raise HTTPException(
            status_code=400, 
            detail=f"店舗から20m以内である必要があります（現在{distance:.1f}m）"
        )
    
    # Create user coupon
    try:
        user_coupon = UserCoupon(
            user_id=current_user.id,
            coupon_id=coupon.id,
            discount_at_obtain=coupon.current_discount,
            status="obtained"
        )
        
        db.add(user_coupon)
        db.commit()
        db.refresh(user_coupon)
        
        return {
            "message": "クーポンを取得しました！",
            "coupon_id": coupon.id,
            "discount": coupon.current_discount,
            "shop_name": store.name
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="クーポンの取得に失敗しました"
        )

@router.get("/stats", response_model=CouponStats)
async def get_coupon_stats(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get coupon statistics for the user"""
    
    # Total active coupons
    total_active = db.query(Coupon).filter(
        Coupon.active_status == "active",
        Coupon.end_time > datetime.now()
    ).count()
    
    # Coupons near user (within 1km)
    active_coupons = db.query(Coupon, Store).join(
        Store, Coupon.store_id == Store.id
    ).filter(
        Coupon.active_status == "active",
        Coupon.end_time > datetime.now(),
        Store.is_active == True
    ).all()
    
    near_user = 0
    for coupon, store in active_coupons:
        distance = calculate_distance(lat, lng, store.latitude, store.longitude)
        if distance <= 1000:  # 1km
            near_user += 1
    
    # User's obtained coupons
    user_obtained = db.query(UserCoupon).filter(
        UserCoupon.user_id == current_user.id
    ).count()
    
    return CouponStats(
        total_active=total_active,
        near_user=near_user,
        user_obtained=user_obtained
    )
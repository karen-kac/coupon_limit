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
import sys
import os
# Add parent directory to path to import external_coupons
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from external_coupons import ExternalCouponService, get_mock_external_coupons

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
    source: Optional[str] = "internal"  # "internal" or "external"
    store_name: Optional[str] = None  # For compatibility with external APIs
    external_url: Optional[str] = None  # External coupon URL

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
        # Handle timezone-aware vs naive datetime
        coupon_end_time = coupon.end_time
        if coupon_end_time.tzinfo is not None:
            # If coupon time is timezone-aware, make now timezone-aware too
            from datetime import timezone
            now_aware = now.replace(tzinfo=timezone.utc)
            time_remaining = coupon_end_time - now_aware
        else:
            # Both are naive
            time_remaining = coupon_end_time - now
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
    radius: int = Query(5000, description="Search radius in meters"),
    include_external: bool = Query(True, description="Include external coupons"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get coupons near the user's location (internal + external), excluding already obtained ones"""
    
    # Update discount rates
    update_coupon_discounts(db)
    
    # Get user's already obtained coupon IDs
    user_obtained_coupon_ids = db.query(UserCoupon.coupon_id).filter(
        UserCoupon.user_id == current_user.id
    ).all()
    obtained_ids = {coupon_id[0] for coupon_id in user_obtained_coupon_ids}
    
    # Get active coupons with their stores (internal), excluding obtained ones
    active_coupons = db.query(Coupon, Store).join(
        Store, Coupon.store_id == Store.id
    ).filter(
        Coupon.active_status == "active",
        Coupon.end_time > datetime.now(),
        Store.is_active == True,
        ~Coupon.id.in_(obtained_ids)  # Exclude already obtained coupons
    ).all()
    
    nearby_coupons = []
    
    # Process internal coupons
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
                description=coupon.description,
                source="internal",
                store_name=store.name
            ))
    
    # Get external coupons if requested
    if include_external:
        try:
            # First try real Kumapon API, fallback to mock data
            external_service = ExternalCouponService()
            external_coupons = await external_service.get_external_coupons_near_location(lat, lng, radius)
            
            # If no real external coupons found, add some mock data for testing
            if not external_coupons:
                external_coupons = await get_mock_external_coupons(lat, lng, radius)
            
            for ext_coupon in external_coupons:
                # Skip if user has already obtained this external coupon
                if ext_coupon['id'] in obtained_ids:
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
                    shop_name=ext_coupon.get('shop_name', ext_coupon.get('store_name', '店舗名不明')),
                    title=ext_coupon['title'],
                    current_discount=ext_coupon['current_discount'],
                    location=Location(
                        lat=ext_coupon['location']['lat'],
                        lng=ext_coupon['location']['lng']
                    ),
                    expires_at=expires_at,
                    time_remaining_minutes=minutes_remaining,
                    distance_meters=round(ext_coupon['distance_meters'], 1),
                    description=ext_coupon.get('description', ''),
                    source="external",
                    store_name=ext_coupon.get('store_name', ext_coupon.get('shop_name', '')),
                    external_url=ext_coupon.get('external_url')
                ))
                
        except Exception as e:
            # Log error but don't fail the entire request
            print(f"Failed to fetch external coupons: {e}")
    
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
    
    try:
        logger.debug(f"Processing coupon get request for coupon_id: {request.coupon_id}")
        logger.debug(f"User location: {request.user_location}")
        logger.debug(f"Current user ID: {current_user.id}")
        
        # Update discount rates
        update_coupon_discounts(db)
        
        # Get coupon with store info
        coupon_data = db.query(Coupon, Store).join(
            Store, Coupon.store_id == Store.id
        ).filter(Coupon.id == request.coupon_id).first()
        
        print(f"DEBUG: Coupon data found: {coupon_data is not None}")
        
        if not coupon_data:
            raise HTTPException(status_code=404, detail="クーポンが見つかりません")
        
        coupon, store = coupon_data
        print(f"DEBUG: Coupon ID: {coupon.id}, Store: {store.name}")
        
        # Check if coupon is still active
        now = datetime.now()
        coupon_end_time = coupon.end_time
        
        # Handle timezone-aware vs naive datetime comparison
        if coupon_end_time.tzinfo is not None:
            # If coupon time is timezone-aware, make now timezone-aware too
            from datetime import timezone
            now = now.replace(tzinfo=timezone.utc)
        elif now.tzinfo is not None:
            # If now is timezone-aware but coupon is naive, make coupon timezone-aware
            coupon_end_time = coupon_end_time.replace(tzinfo=timezone.utc)
        
        if coupon.active_status != "active" or coupon_end_time <= now:
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
        
        print(f"DEBUG: Distance to store: {distance}m")
        if distance > 20:  # 20 meters
            raise HTTPException(
                status_code=400, 
                detail=f"店舗から20m以内である必要があります（現在{distance:.1f}m）"
            )
        
        # Create user coupon
        user_coupon = UserCoupon(
            user_id=current_user.id,
            coupon_id=coupon.id,
            discount_at_obtain=coupon.current_discount,
            status="obtained"
        )
        
        db.add(user_coupon)
        db.commit()
        db.refresh(user_coupon)
        
        print(f"DEBUG: Successfully created user coupon")
        return {
            "message": "クーポンを取得しました！",
            "coupon_id": coupon.id,
            "discount": coupon.current_discount,
            "shop_name": store.name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: Unexpected error in obtain_coupon: {e}")
        import traceback
        print(f"DEBUG: Traceback: {traceback.format_exc()}")
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
        if distance <= 1000000000:  # 1km
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

@router.get("/external-test")
async def test_external_coupons(
    lat: float = Query(35.6812, description="User latitude"),
    lng: float = Query(139.7671, description="User longitude"),
    radius: int = Query(5000, description="Search radius in meters")
):
    """Test external coupons without database dependency"""
    try:
        # Test external coupons service directly
        external_service = ExternalCouponService()
        external_coupons = await external_service.get_external_coupons_near_location(lat, lng, radius)
        
        # If no real external coupons found, add some mock data for testing
        if not external_coupons:
            external_coupons = await get_mock_external_coupons(lat, lng, radius)
        
        result = []
        for ext_coupon in external_coupons:
            # Convert external coupon format to simple response
            try:
                expires_at = datetime.fromisoformat(ext_coupon['expires_at'].replace('Z', '+00:00'))
            except:
                expires_at = ext_coupon['end_time']
            
            time_remaining = expires_at - datetime.now()
            minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
            
            result.append({
                "id": ext_coupon['id'],
                "shop_name": ext_coupon.get('shop_name', ext_coupon.get('store_name', '店舗名不明')),
                "title": ext_coupon['title'],
                "current_discount": ext_coupon['current_discount'],
                "location": {
                    "lat": ext_coupon['location']['lat'],
                    "lng": ext_coupon['location']['lng']
                },
                "expires_at": expires_at.isoformat(),
                "time_remaining_minutes": minutes_remaining,
                "distance_meters": round(ext_coupon['distance_meters'], 1),
                "description": ext_coupon.get('description', ''),
                "source": "external",
                "store_name": ext_coupon.get('store_name', ext_coupon.get('shop_name', '')),
                "external_url": ext_coupon.get('external_url', f"https://kumapon.jp/deals/{ext_coupon['external_id']}")
            })
        
        return {"external_coupons": result, "count": len(result)}
    
    except Exception as e:
        return {"error": str(e), "external_coupons": [], "count": 0}

@router.get("/hotpepper-test")
async def test_hotpepper_coupons(
    lat: float = Query(35.6812, description="User latitude"),
    lng: float = Query(139.7671, description="User longitude"),
    radius: int = Query(3000, description="Search radius in meters")
):
    """Test Hot Pepper coupons without database dependency"""
    try:
        # Test Hot Pepper coupons service directly
        external_service = ExternalCouponService()
        hotpepper_coupons = await external_service.fetch_hotpepper_coupons_near_location(lat, lng, radius)
        
        result = []
        for ext_coupon in hotpepper_coupons:
            # Convert Hot Pepper coupon format to simple response
            try:
                expires_at = datetime.fromisoformat(ext_coupon['expires_at'].replace('Z', '+00:00'))
            except:
                expires_at = ext_coupon['end_time']
            
            time_remaining = expires_at - datetime.now()
            minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
            
            result.append({
                "id": ext_coupon['id'],
                "shop_name": ext_coupon.get('shop_name', ext_coupon.get('store_name', '店舗名不明')),
                "title": ext_coupon['title'],
                "current_discount": ext_coupon['current_discount'],
                "location": {
                    "lat": ext_coupon['location']['lat'],
                    "lng": ext_coupon['location']['lng']
                },
                "expires_at": expires_at.isoformat(),
                "time_remaining_minutes": minutes_remaining,
                "distance_meters": round(ext_coupon['distance_meters'], 1),
                "description": ext_coupon.get('description', ''),
                "source": "hotpepper",
                "store_name": ext_coupon.get('store_name', ext_coupon.get('shop_name', '')),
                "external_url": ext_coupon.get('external_url'),
                "genre": ext_coupon.get('genre', ''),
                "budget": ext_coupon.get('budget', ''),
                "access": ext_coupon.get('access', '')
            })
        
        return {"hotpepper_coupons": result, "count": len(result)}
    
    except Exception as e:
        return {"error": str(e), "hotpepper_coupons": [], "count": 0}

@router.get("/public", response_model=List[CouponResponse])
async def get_nearby_coupons_public(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    radius: int = Query(5000, description="Search radius in meters"),
    include_external: bool = Query(True, description="Include external coupons"),
    db: Session = Depends(get_db)
):
    """Get coupons near the user's location (public endpoint - no authentication required)"""
    
    # Update discount rates
    update_coupon_discounts(db)
    
    # Get active coupons with their stores (internal)
    active_coupons = db.query(Coupon, Store).join(
        Store, Coupon.store_id == Store.id
    ).filter(
        Coupon.active_status == "active",
        Coupon.end_time > datetime.now(),
        Store.is_active == True
    ).all()
    
    nearby_coupons = []
    
    # Process internal coupons
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
                description=coupon.description,
                source="internal",
                store_name=store.name
            ))
    
    # Get external coupons if requested
    if include_external:
        try:
            # First try real Kumapon API, fallback to mock data
            external_service = ExternalCouponService()
            external_coupons = await external_service.get_external_coupons_near_location(lat, lng, radius)
            
            # If no real external coupons found, add some mock data for testing
            if not external_coupons:
                external_coupons = await get_mock_external_coupons(lat, lng, radius)
            
            for ext_coupon in external_coupons:
                # Convert external coupon format to CouponResponse
                try:
                    expires_at = datetime.fromisoformat(ext_coupon['expires_at'].replace('Z', '+00:00'))
                except:
                    expires_at = ext_coupon['end_time']
                
                time_remaining = expires_at - datetime.now()
                minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
                
                nearby_coupons.append(CouponResponse(
                    id=ext_coupon['id'],
                    shop_name=ext_coupon.get('shop_name', ext_coupon.get('store_name', '店舗名不明')),
                    title=ext_coupon['title'],
                    current_discount=ext_coupon['current_discount'],
                    location=Location(
                        lat=ext_coupon['location']['lat'],
                        lng=ext_coupon['location']['lng']
                    ),
                    expires_at=expires_at,
                    time_remaining_minutes=minutes_remaining,
                    distance_meters=round(ext_coupon['distance_meters'], 1),
                    description=ext_coupon.get('description', ''),
                    source="external",
                    store_name=ext_coupon.get('store_name', ext_coupon.get('shop_name', '')),
                    external_url=ext_coupon.get('external_url')
                ))
                
        except Exception as e:
            # Log error but don't fail the entire request
            print(f"Failed to fetch external coupons: {e}")
    
    # Sort by distance
    nearby_coupons.sort(key=lambda x: x.distance_meters or 0)
    
    return nearby_coupons
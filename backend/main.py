from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import math
import uuid
from sqlalchemy.orm import Session
from database import (
    get_db, CouponRepository, UserCouponRepository,
    db_coupon_to_dict, db_user_coupon_to_dict
)

app = FastAPI(title="Coupon Location API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発中は "*" でOK
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class Location(BaseModel):
    lat: float
    lng: float

class Coupon(BaseModel):
    id: str
    shop_name: str
    title: str
    base_discount: int
    current_discount: int
    location: Location
    expires_at: datetime
    created_at: datetime
    is_active: bool = True

class UserCoupon(BaseModel):
    id: str
    coupon_id: str
    user_id: str
    shop_name: str
    title: str
    discount: int
    obtained_at: datetime
    is_used: bool = False
    used_at: Optional[datetime] = None

class CouponResponse(BaseModel):
    id: str
    shop_name: str
    title: str
    current_discount: int
    location: Location
    expires_at: datetime
    time_remaining_minutes: int
    distance_meters: Optional[float] = None

class GetCouponRequest(BaseModel):
    coupon_id: str
    user_location: Location
    user_id: str

class CreateCouponRequest(BaseModel):
    shop_name: str
    title: str
    base_discount: int
    location: Location
    expires_minutes: int
    conditions: Optional[str] = None

class UpdateCouponRequest(BaseModel):
    shop_name: Optional[str] = None
    title: Optional[str] = None
    base_discount: Optional[int] = None
    location: Optional[Location] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None

class CouponStats(BaseModel):
    id: str
    shop_name: str
    title: str
    total_obtained: int
    total_used: int
    obtain_rate: float
    usage_rate: float
    created_at: datetime
    expires_at: datetime
    is_active: bool

# Database will be used instead of in-memory storage

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

def calculate_current_discount(coupon: Coupon) -> int:
    """Calculate current discount based on time remaining"""
    now = datetime.now()
    time_remaining = coupon.expires_at - now
    minutes_remaining = time_remaining.total_seconds() / 60
    
    if minutes_remaining <= 0:
        return coupon.base_discount
    elif minutes_remaining <= 10:
        return min(50, coupon.base_discount + 30)
    elif minutes_remaining <= 30:
        return min(40, coupon.base_discount + 20)
    elif minutes_remaining <= 60:
        return min(30, coupon.base_discount + 10)
    else:
        return coupon.base_discount

def update_coupon_discounts(db: Session):
    """Update all coupon discounts"""
    coupon_repo = CouponRepository(db)
    active_coupons = coupon_repo.get_active_coupons()
    
    for db_coupon in active_coupons:
        # Convert to Coupon object for calculation
        coupon_dict = db_coupon_to_dict(db_coupon)
        coupon = Coupon(**coupon_dict)
        new_discount = calculate_current_discount(coupon)
        
        if new_discount != db_coupon.current_discount:
            coupon_repo.update_coupon_discount(db_coupon.id, new_discount)

@app.on_event("startup")
async def startup_event():
    """Initialize with sample data if database is empty"""
    db = next(get_db())
    coupon_repo = CouponRepository(db)
    
    # Check if we already have coupons
    existing_coupons = coupon_repo.get_all_coupons()
    if len(existing_coupons) > 0:
        return  # Already have data
    
    # Tokyo Station area sample coupons
    sample_coupons = [
        {
            "shop_name": "コーヒーショップ",
            "title": "ドリンク全品",
            "base_discount": 15,
            "location": {"lat": 35.6812, "lng": 139.7671},
            "expires_minutes": 30
        },
        {
            "shop_name": "レストラン",
            "title": "ランチメニュー",
            "base_discount": 20,
            "location": {"lat": 35.6815, "lng": 139.7675},
            "expires_minutes": 45
        },
        {
            "shop_name": "書店",
            "title": "文房具",
            "base_discount": 10,
            "location": {"lat": 35.6810, "lng": 139.7665},
            "expires_minutes": 60
        }
    ]
    
    now = datetime.now()
    for sample in sample_coupons:
        coupon_data = {
            "shop_name": sample["shop_name"],
            "title": sample["title"],
            "base_discount": sample["base_discount"],
            "location": sample["location"],
            "expires_at": now + timedelta(minutes=sample["expires_minutes"])
        }
        coupon_repo.create_coupon(coupon_data)
    
    db.close()

@app.get("/api/coupons")
async def get_coupons(lat: float, lng: float, radius: int = 1000, db: Session = Depends(get_db)) -> List[CouponResponse]:
    """Get all active coupons within radius"""
    update_coupon_discounts(db)
    coupon_repo = CouponRepository(db)
    user_location = Location(lat=lat, lng=lng)
    
    active_coupons = coupon_repo.get_active_coupons()
    nearby_coupons = []
    
    for db_coupon in active_coupons:
        distance = calculate_distance(
            user_location.lat, user_location.lng,
            db_coupon.lat, db_coupon.lng
        )
        
        if distance <= radius:
            now = datetime.now()
            time_remaining = db_coupon.expires_at - now
            minutes_remaining = max(0, int(time_remaining.total_seconds() / 60))
            
            nearby_coupons.append(CouponResponse(
                id=db_coupon.id,
                shop_name=db_coupon.shop_name,
                title=db_coupon.title,
                current_discount=db_coupon.current_discount,
                location=Location(lat=db_coupon.lat, lng=db_coupon.lng),
                expires_at=db_coupon.expires_at,
                time_remaining_minutes=minutes_remaining,
                distance_meters=distance
            ))
    
    return nearby_coupons

@app.post("/api/coupons/get")
async def get_coupon(request: GetCouponRequest, db: Session = Depends(get_db)):
    """Get a specific coupon if user is within 20m"""
    update_coupon_discounts(db)
    coupon_repo = CouponRepository(db)
    user_coupon_repo = UserCouponRepository(db)
    
    # Find the coupon
    db_coupon = coupon_repo.get_coupon(request.coupon_id)
    if not db_coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    # Check if user already has this coupon
    if user_coupon_repo.check_user_has_coupon(request.user_id, request.coupon_id):
        raise HTTPException(status_code=400, detail="Coupon already obtained")
    
    # Check distance
    distance = calculate_distance(
        request.user_location.lat, request.user_location.lng,
        db_coupon.lat, db_coupon.lng
    )
    
    if distance > 20:  # 20 meters
        raise HTTPException(
            status_code=400, 
            detail=f"Too far from coupon location (distance: {distance:.1f}m)"
        )
    
    # Create user coupon
    user_coupon_data = {
        "coupon_id": db_coupon.id,
        "user_id": request.user_id,
        "shop_name": db_coupon.shop_name,
        "title": db_coupon.title,
        "discount": db_coupon.current_discount
    }
    
    db_user_coupon = user_coupon_repo.create_user_coupon(user_coupon_data)
    user_coupon_dict = db_user_coupon_to_dict(db_user_coupon)
    
    return {"message": "Coupon obtained successfully", "coupon": user_coupon_dict}

@app.get("/api/user/{user_id}/coupons")
async def get_user_coupons(user_id: str, db: Session = Depends(get_db)) -> List[dict]:
    """Get all coupons for a user"""
    user_coupon_repo = UserCouponRepository(db)
    db_user_coupons = user_coupon_repo.get_user_coupons(user_id)
    return [db_user_coupon_to_dict(uc) for uc in db_user_coupons]

@app.post("/api/user/{user_id}/coupons/{coupon_id}/use")
async def use_coupon(user_id: str, coupon_id: str, db: Session = Depends(get_db)):
    """Mark a coupon as used"""
    user_coupon_repo = UserCouponRepository(db)
    
    db_user_coupon = user_coupon_repo.use_coupon(coupon_id, user_id)
    
    if not db_user_coupon:
        raise HTTPException(status_code=404, detail="User coupon not found")
    
    if not db_user_coupon.is_used:
        raise HTTPException(status_code=400, detail="Failed to use coupon")
    
    return {"message": "Coupon used successfully"}

# Admin endpoints
@app.post("/api/admin/coupons")
async def create_coupon(request: CreateCouponRequest, db: Session = Depends(get_db)):
    """Create a new coupon (Admin only)"""
    coupon_repo = CouponRepository(db)
    now = datetime.now()
    expires_at = now + timedelta(minutes=request.expires_minutes)
    
    coupon_data = {
        "shop_name": request.shop_name,
        "title": request.title,
        "base_discount": request.base_discount,
        "location": {"lat": request.location.lat, "lng": request.location.lng},
        "expires_at": expires_at,
        "conditions": request.conditions
    }
    
    db_coupon = coupon_repo.create_coupon(coupon_data)
    coupon_dict = db_coupon_to_dict(db_coupon)
    
    return {"message": "Coupon created successfully", "coupon": coupon_dict}

@app.get("/api/admin/coupons")
async def get_all_coupons(db: Session = Depends(get_db)) -> List[dict]:
    """Get all coupons with admin view"""
    coupon_repo = CouponRepository(db)
    db_coupons = coupon_repo.get_all_coupons()
    return [db_coupon_to_dict(coupon) for coupon in db_coupons]

@app.get("/api/admin/coupons/{coupon_id}")
async def get_coupon_details(coupon_id: str, db: Session = Depends(get_db)):
    """Get detailed coupon information including stats"""
    coupon_repo = CouponRepository(db)
    user_coupon_repo = UserCouponRepository(db)
    
    db_coupon = coupon_repo.get_coupon(coupon_id)
    if not db_coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    # Calculate stats
    obtained_coupons = user_coupon_repo.get_coupon_users(coupon_id)
    used_coupons = [uc for uc in obtained_coupons if uc.is_used]
    
    total_obtained = len(obtained_coupons)
    total_used = len(used_coupons)
    obtain_rate = 0.0  # This would need view/impression data in real app
    usage_rate = (total_used / total_obtained * 100) if total_obtained > 0 else 0.0
    
    stats = CouponStats(
        id=db_coupon.id,
        shop_name=db_coupon.shop_name,
        title=db_coupon.title,
        total_obtained=total_obtained,
        total_used=total_used,
        obtain_rate=obtain_rate,
        usage_rate=usage_rate,
        created_at=db_coupon.created_at,
        expires_at=db_coupon.expires_at,
        is_active=db_coupon.is_active
    )
    
    return {
        "coupon": db_coupon_to_dict(db_coupon),
        "stats": stats,
        "obtained_by_users": [db_user_coupon_to_dict(uc) for uc in obtained_coupons]
    }

@app.put("/api/admin/coupons/{coupon_id}")
async def update_coupon(coupon_id: str, request: UpdateCouponRequest, db: Session = Depends(get_db)):
    """Update an existing coupon"""
    coupon_repo = CouponRepository(db)
    
    update_data = {}
    if request.shop_name is not None:
        update_data["shop_name"] = request.shop_name
    if request.title is not None:
        update_data["title"] = request.title
    if request.base_discount is not None:
        update_data["base_discount"] = request.base_discount
    if request.location is not None:
        update_data["location"] = {"lat": request.location.lat, "lng": request.location.lng}
    if request.expires_at is not None:
        update_data["expires_at"] = request.expires_at
    if request.is_active is not None:
        update_data["is_active"] = request.is_active
    
    db_coupon = coupon_repo.update_coupon(coupon_id, update_data)
    if not db_coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return {"message": "Coupon updated successfully", "coupon": db_coupon_to_dict(db_coupon)}

@app.delete("/api/admin/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, db: Session = Depends(get_db)):
    """Delete a coupon"""
    coupon_repo = CouponRepository(db)
    
    if not coupon_repo.delete_coupon(coupon_id):
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    return {"message": "Coupon deleted successfully"}

@app.get("/api/admin/stats")
async def get_admin_stats(db: Session = Depends(get_db)):
    """Get overall statistics for admin dashboard"""
    coupon_repo = CouponRepository(db)
    user_coupon_repo = UserCouponRepository(db)
    
    now = datetime.now()
    all_coupons = coupon_repo.get_all_coupons()
    active_coupons = [c for c in all_coupons if c.is_active and c.expires_at > now]
    expired_coupons = [c for c in all_coupons if c.expires_at <= now]
    
    all_user_coupons = user_coupon_repo.get_all_user_coupons()
    total_obtained = len(all_user_coupons)
    total_used = len([uc for uc in all_user_coupons if uc.is_used])
    
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
    return {"status": "healthy", "timestamp": datetime.now()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
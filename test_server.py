from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
import json

app = FastAPI(title="Test API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock data
users = {}
tokens = {}
coupons = [
    {
        "id": "1",
        "store_name": "コーヒーショップ",
        "title": "ドリンク全品",
        "description": "コーヒー、紅茶、ジュース全品対象",
        "current_discount": 15,
        "location": {"lat": 35.6812, "lng": 139.7671},
        "expires_at": (datetime.now() + timedelta(minutes=90)).isoformat(),
        "time_remaining_minutes": 90,
        "distance_meters": 10
    },
    {
        "id": "2",
        "store_name": "レストラン",
        "title": "ランチメニュー",
        "description": "定食、丼物、麺類など",
        "current_discount": 20,
        "location": {"lat": 35.6815, "lng": 139.7675},
        "expires_at": (datetime.now() + timedelta(minutes=120)).isoformat(),
        "time_remaining_minutes": 120,
        "distance_meters": 50
    }
]
user_coupons = {}
admin_token = "admin_token_123"

# Pydantic models
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

class Location(BaseModel):
    lat: float
    lng: float

class GetCouponRequest(BaseModel):
    coupon_id: str
    user_location: Location

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
    discount_rate_schedule: Optional[List[dict]] = None
    start_time: datetime
    end_time: datetime

# Helper functions
def get_token_from_header(authorization: str):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    token = authorization.replace("Bearer ", "")
    if token not in tokens.values():
        raise HTTPException(status_code=401, detail="Invalid token")
    return token

# Endpoints
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat(), "version": "2.0"}

@app.post("/api/auth/register")
async def register_user(user_data: UserRegisterRequest):
    if user_data.email in users:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    users[user_data.email] = {
        "id": f"user_{len(users) + 1}",
        "name": user_data.name,
        "email": user_data.email,
        "password": user_data.password
    }
    
    token = f"token_{len(tokens) + 1}"
    tokens[users[user_data.email]["id"]] = token
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": users[user_data.email]["id"],
            "name": user_data.name,
            "email": user_data.email
        }
    }

@app.post("/api/auth/login")
async def login_user(user_data: UserLoginRequest):
    if user_data.email not in users or users[user_data.email]["password"] != user_data.password:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    user_id = users[user_data.email]["id"]
    if user_id not in tokens:
        tokens[user_id] = f"token_{len(tokens) + 1}"
    
    return {
        "access_token": tokens[user_id],
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "name": users[user_data.email]["name"],
            "email": user_data.email
        }
    }

@app.post("/api/auth/admin/login")
async def login_admin(admin_data: AdminLoginRequest):
    if admin_data.email != "store@example.com" or admin_data.password != "password123":
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    return {
        "access_token": admin_token,
        "token_type": "bearer",
        "admin": {
            "id": "admin_1",
            "email": admin_data.email,
            "role": "store_owner",
            "linked_store_id": "store_1"
        }
    }

@app.get("/api/auth/me")
async def get_current_user_info(authorization: Optional[str] = None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token")
    
    token = authorization.replace("Bearer ", "")
    
    for user_id, user_token in tokens.items():
        if user_token == token:
            user_email = None
            for email, user in users.items():
                if user["id"] == user_id:
                    user_email = email
                    break
            
            if user_email:
                return {
                    "id": user_id,
                    "name": users[user_email]["name"],
                    "email": user_email
                }
    
    raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/api/coupons")
async def get_coupons(lat: float, lng: float, radius: int = 1000, authorization: Optional[str] = None):
    # Track user location if authenticated
    if authorization:
        try:
            get_token_from_header(authorization)
            # In a real app, we would track the location here
        except:
            pass
    
    return coupons

@app.get("/api/user/coupons")
async def get_user_coupons(authorization: str = Depends(lambda x: x.headers.get("Authorization"))):
    token = get_token_from_header(authorization)
    
    user_id = None
    for uid, user_token in tokens.items():
        if user_token == token:
            user_id = uid
            break
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    if user_id not in user_coupons:
        return []
    
    return user_coupons[user_id]

@app.post("/api/coupons/get")
async def get_coupon(request: GetCouponRequest, authorization: str = Depends(lambda x: x.headers.get("Authorization"))):
    token = get_token_from_header(authorization)
    
    user_id = None
    for uid, user_token in tokens.items():
        if user_token == token:
            user_id = uid
            break
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Find the coupon
    coupon = None
    for c in coupons:
        if c["id"] == request.coupon_id:
            coupon = c
            break
    
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    
    # Check if user already has this coupon
    if user_id in user_coupons and any(uc["coupon_id"] == request.coupon_id for uc in user_coupons[user_id]):
        raise HTTPException(status_code=400, detail="Coupon already obtained")
    
    # Check distance (300 meters)
    import math
    
    def calculate_distance(lat1, lng1, lat2, lng2):
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
    
    distance = calculate_distance(
        request.user_location.lat, request.user_location.lng,
        coupon["location"]["lat"], coupon["location"]["lng"]
    )
    
    if distance > 300:
        raise HTTPException(
            status_code=400, 
            detail=f"Too far from coupon location (distance: {distance:.1f}m)"
        )
    
    # Create user coupon
    user_coupon = {
        "id": f"user_coupon_{len(user_coupons) + 1}",
        "user_id": user_id,
        "coupon_id": coupon["id"],
        "obtained_at": datetime.now().isoformat(),
        "status": "obtained",
        "discount_at_obtain": coupon["current_discount"]
    }
    
    if user_id not in user_coupons:
        user_coupons[user_id] = []
    
    user_coupons[user_id].append(user_coupon)
    
    return {
        "message": "Coupon obtained successfully", 
        "coupon": user_coupon
    }

@app.get("/api/admin/stats")
async def get_admin_stats(authorization: str = Depends(lambda x: x.headers.get("Authorization"))):
    if authorization != f"Bearer {admin_token}":
        raise HTTPException(status_code=401, detail="Invalid admin token")
    
    return {
        "total_coupons": len(coupons),
        "active_coupons": len(coupons),
        "expired_coupons": 0,
        "total_obtained": sum(len(ucs) for ucs in user_coupons.values()),
        "total_used": sum(len([uc for uc in ucs if uc.get("status") == "used"]) for ucs in user_coupons.values()),
        "overall_usage_rate": 0.0
    }

@app.post("/api/stores")
async def create_store(store_data: StoreCreateRequest, authorization: str = Depends(lambda x: x.headers.get("Authorization"))):
    if authorization != f"Bearer {admin_token}":
        raise HTTPException(status_code=401, detail="Invalid admin token")
    
    store = {
        "id": f"store_{len(coupons) + 1}",
        "name": store_data.name,
        "description": store_data.description,
        "latitude": store_data.latitude,
        "longitude": store_data.longitude,
        "address": store_data.address,
        "logo_url": store_data.logo_url,
        "owner_email": "store@example.com"
    }
    
    return {"message": "Store created successfully", "store": store}

@app.post("/api/store/coupons")
async def create_store_coupon(coupon_data: CouponCreateRequest, authorization: str = Depends(lambda x: x.headers.get("Authorization"))):
    if authorization != f"Bearer {admin_token}":
        raise HTTPException(status_code=401, detail="Invalid admin token")
    
    coupon = {
        "id": f"coupon_{len(coupons) + 1}",
        "store_id": "store_1",
        "title": coupon_data.title,
        "description": coupon_data.description,
        "discount_rate_initial": coupon_data.discount_rate_initial,
        "discount_rate_schedule": coupon_data.discount_rate_schedule,
        "start_time": coupon_data.start_time.isoformat(),
        "end_time": coupon_data.end_time.isoformat(),
        "current_discount": coupon_data.discount_rate_initial
    }
    
    return {"message": "Coupon created successfully", "coupon": coupon}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
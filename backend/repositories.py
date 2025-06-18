from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional, Dict, Any
import uuid
from backend.models import User, Store, Coupon, UserCoupon, Admin, GeoPoint, Reservation
from auth import get_password_hash, verify_password

class UserRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create_user(self, user_data: dict) -> User:
        """Create a new user"""
        db_user = User(
            id=str(uuid.uuid4()),
            name=user_data["name"],
            email=user_data["email"],
            password_hash=get_password_hash(user_data["password"]),
            created_at=datetime.now()
        )
        self.db.add(db_user)
        self.db.commit()
        self.db.refresh(db_user)
        return db_user
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        return self.db.query(User).filter(User.email == email).first()
    
    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()
    
    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password"""
        user = self.get_user_by_email(email)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user
    
    def update_user(self, user_id: str, update_data: dict) -> Optional[User]:
        """Update user information"""
        user = self.get_user_by_id(user_id)
        if user:
            for key, value in update_data.items():
                if hasattr(user, key) and value is not None:
                    if key == "password":
                        user.password_hash = get_password_hash(value)
                    else:
                        setattr(user, key, value)
            user.updated_at = datetime.now()
            self.db.commit()
            self.db.refresh(user)
        return user

class StoreRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create_store(self, store_data: dict) -> Store:
        """Create a new store"""
        db_store = Store(
            id=str(uuid.uuid4()),
            name=store_data["name"],
            description=store_data.get("description"),
            logo_url=store_data.get("logo_url"),
            latitude=store_data["latitude"],
            longitude=store_data["longitude"],
            address=store_data.get("address"),
            owner_email=store_data["owner_email"],
            created_at=datetime.now()
        )
        self.db.add(db_store)
        self.db.commit()
        self.db.refresh(db_store)
        return db_store
    
    def get_store_by_id(self, store_id: str) -> Optional[Store]:
        """Get store by ID"""
        return self.db.query(Store).filter(Store.id == store_id).first()
    
    def get_stores_by_owner(self, owner_email: str) -> List[Store]:
        """Get all stores owned by an email"""
        return self.db.query(Store).filter(Store.owner_email == owner_email).all()
    
    def get_all_stores(self) -> List[Store]:
        """Get all active stores"""
        return self.db.query(Store).filter(Store.is_active == True).all()
    
    def update_store(self, store_id: str, update_data: dict) -> Optional[Store]:
        """Update store information"""
        store = self.get_store_by_id(store_id)
        if store:
            for key, value in update_data.items():
                if hasattr(store, key) and value is not None:
                    setattr(store, key, value)
            store.updated_at = datetime.now()
            self.db.commit()
            self.db.refresh(store)
        return store

class EnhancedCouponRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create_coupon(self, coupon_data: dict) -> Coupon:
        """Create a new coupon with enhanced features"""
        db_coupon = Coupon(
            id=str(uuid.uuid4()),
            store_id=coupon_data["store_id"],
            title=coupon_data["title"],
            description=coupon_data.get("description"),
            discount_rate_initial=coupon_data["discount_rate_initial"],
            discount_rate_schedule=coupon_data.get("discount_rate_schedule", []),
            start_time=coupon_data["start_time"],
            end_time=coupon_data["end_time"],
            active_status="active",
            current_discount=coupon_data["discount_rate_initial"],  # Initialize with base discount
            created_at=datetime.now()
        )
        self.db.add(db_coupon)
        self.db.commit()
        self.db.refresh(db_coupon)
        return db_coupon
    
    def get_coupon_by_id(self, coupon_id: str) -> Optional[Coupon]:
        """Get coupon by ID"""
        return self.db.query(Coupon).filter(Coupon.id == coupon_id).first()
    
    def get_active_coupons(self) -> List[Coupon]:
        """Get all active coupons that haven't expired"""
        now = datetime.now()
        return self.db.query(Coupon).filter(
            Coupon.active_status == "active",
            Coupon.end_time > now
        ).all()
    
    def get_coupons_by_store(self, store_id: str) -> List[Coupon]:
        """Get all coupons for a specific store"""
        return self.db.query(Coupon).filter(Coupon.store_id == store_id).all()
    
    def update_coupon_status(self, coupon_id: str, status: str) -> Optional[Coupon]:
        """Update coupon status (active/expired/exploded)"""
        coupon = self.get_coupon_by_id(coupon_id)
        if coupon:
            coupon.active_status = status
            coupon.updated_at = datetime.now()
            self.db.commit()
            self.db.refresh(coupon)
        return coupon
    
    def calculate_current_discount(self, coupon: Coupon) -> int:
        """Calculate current discount based on time remaining and schedule"""
        now = datetime.now()
        
        # Check if expired
        if now >= coupon.end_time:
            return coupon.discount_rate_initial
        
        # Calculate time remaining in minutes
        time_remaining = coupon.end_time - now
        minutes_remaining = time_remaining.total_seconds() / 60
        
        # Use dynamic schedule if available
        if coupon.discount_rate_schedule:
            current_rate = coupon.discount_rate_initial
            for schedule_item in coupon.discount_rate_schedule:
                if minutes_remaining <= schedule_item["time_remain_min"]:
                    current_rate = schedule_item["rate"]
            return current_rate
        
        # Fallback to legacy calculation
        if minutes_remaining <= 10:
            return min(50, coupon.discount_rate_initial + 30)
        elif minutes_remaining <= 30:
            return min(40, coupon.discount_rate_initial + 20)
        elif minutes_remaining <= 60:
            return min(30, coupon.discount_rate_initial + 10)
        else:
            return coupon.discount_rate_initial

class EnhancedUserCouponRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create_user_coupon(self, user_coupon_data: dict) -> UserCoupon:
        """Create a new user coupon record"""
        db_user_coupon = UserCoupon(
            id=str(uuid.uuid4()),
            user_id=user_coupon_data["user_id"],
            coupon_id=user_coupon_data["coupon_id"],
            obtained_at=datetime.now(),
            status="obtained",
            discount_at_obtain=user_coupon_data["discount_at_obtain"]
        )
        self.db.add(db_user_coupon)
        self.db.commit()
        self.db.refresh(db_user_coupon)
        return db_user_coupon
    
    def get_user_coupons(self, user_id: str) -> List[UserCoupon]:
        """Get all coupons for a user"""
        return self.db.query(UserCoupon).filter(UserCoupon.user_id == user_id).all()
    
    def check_user_has_coupon(self, user_id: str, coupon_id: str) -> bool:
        """Check if user already has this coupon"""
        existing = self.db.query(UserCoupon).filter(
            UserCoupon.user_id == user_id,
            UserCoupon.coupon_id == coupon_id
        ).first()
        return existing is not None
    
    def use_coupon(self, user_coupon_id: str, user_id: str) -> Optional[UserCoupon]:
        """Mark a coupon as used"""
        user_coupon = self.db.query(UserCoupon).filter(
            UserCoupon.id == user_coupon_id,
            UserCoupon.user_id == user_id,
            UserCoupon.status == "obtained"
        ).first()
        
        if user_coupon:
            user_coupon.used_at = datetime.now()
            user_coupon.status = "used"
            self.db.commit()
            self.db.refresh(user_coupon)
        
        return user_coupon

class AdminRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create_admin(self, admin_data: dict) -> Admin:
        """Create a new admin/store owner"""
        db_admin = Admin(
            id=str(uuid.uuid4()),
            email=admin_data["email"],
            password_hash=get_password_hash(admin_data["password"]),
            role=admin_data["role"],
            linked_store_id=admin_data.get("linked_store_id"),
            created_at=datetime.now()
        )
        self.db.add(db_admin)
        self.db.commit()
        self.db.refresh(db_admin)
        return db_admin
    
    def get_admin_by_email(self, email: str) -> Optional[Admin]:
        """Get admin by email"""
        return self.db.query(Admin).filter(Admin.email == email).first()
    
    def authenticate_admin(self, email: str, password: str) -> Optional[Admin]:
        """Authenticate admin with email and password"""
        admin = self.get_admin_by_email(email)
        if not admin:
            return None
        if not verify_password(password, admin.password_hash):
            return None
        return admin

class GeoPointRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def add_location_point(self, user_id: str, latitude: float, longitude: float) -> GeoPoint:
        """Add a location point for a user"""
        db_geo_point = GeoPoint(
            id=str(uuid.uuid4()),
            user_id=user_id,
            latitude=latitude,
            longitude=longitude,
            timestamp=datetime.now()
        )
        self.db.add(db_geo_point)
        self.db.commit()
        self.db.refresh(db_geo_point)
        return db_geo_point
    
    def get_user_location_history(self, user_id: str, limit: int = 100) -> List[GeoPoint]:
        """Get user's location history"""
        return self.db.query(GeoPoint).filter(
            GeoPoint.user_id == user_id
        ).order_by(GeoPoint.timestamp.desc()).limit(limit).all()

# Helper functions to convert models to dictionaries
def user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "is_active": user.is_active
    }

def store_to_dict(store: Store) -> dict:
    return {
        "id": store.id,
        "name": store.name,
        "description": store.description,
        "logo_url": store.logo_url,
        "latitude": store.latitude,
        "longitude": store.longitude,
        "address": store.address,
        "owner_email": store.owner_email,
        "created_at": store.created_at,
        "updated_at": store.updated_at,
        "is_active": store.is_active
    }

def coupon_to_dict(coupon: Coupon) -> dict:
    return {
        "id": coupon.id,
        "store_id": coupon.store_id,
        "title": coupon.title,
        "description": coupon.description,
        "discount_rate_initial": coupon.discount_rate_initial,
        "discount_rate_schedule": coupon.discount_rate_schedule,
        "current_discount": coupon.current_discount,
        "start_time": coupon.start_time,
        "end_time": coupon.end_time,
        "active_status": coupon.active_status,
        "created_at": coupon.created_at,
        "updated_at": coupon.updated_at
    }

def user_coupon_to_dict(user_coupon: UserCoupon) -> dict:
    return {
        "id": user_coupon.id,
        "user_id": user_coupon.user_id,
        "coupon_id": user_coupon.coupon_id,
        "obtained_at": user_coupon.obtained_at,
        "used_at": user_coupon.used_at,
        "status": user_coupon.status,
        "discount_at_obtain": user_coupon.discount_at_obtain
    }
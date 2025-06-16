from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import uuid

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./coupon_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models
class CouponDB(Base):
    __tablename__ = "coupons"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    shop_name = Column(String, nullable=False)
    title = Column(String, nullable=False)
    base_discount = Column(Integer, nullable=False)
    current_discount = Column(Integer, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True)
    conditions = Column(Text, nullable=True)

class UserCouponDB(Base):
    __tablename__ = "user_coupons"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    coupon_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    shop_name = Column(String, nullable=False)
    title = Column(String, nullable=False)
    discount = Column(Integer, nullable=False)
    obtained_at = Column(DateTime, default=datetime.now)
    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime, nullable=True)

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Database operations
class CouponRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create_coupon(self, coupon_data: dict) -> CouponDB:
        db_coupon = CouponDB(
            id=str(uuid.uuid4()),
            shop_name=coupon_data["shop_name"],
            title=coupon_data["title"],
            base_discount=coupon_data["base_discount"],
            current_discount=coupon_data["base_discount"],
            lat=coupon_data["location"]["lat"],
            lng=coupon_data["location"]["lng"],
            expires_at=coupon_data["expires_at"],
            created_at=datetime.now(),
            conditions=coupon_data.get("conditions")
        )
        self.db.add(db_coupon)
        self.db.commit()
        self.db.refresh(db_coupon)
        return db_coupon
    
    def get_coupon(self, coupon_id: str) -> CouponDB:
        return self.db.query(CouponDB).filter(CouponDB.id == coupon_id).first()
    
    def get_all_coupons(self) -> list[CouponDB]:
        return self.db.query(CouponDB).all()
    
    def get_active_coupons(self) -> list[CouponDB]:
        now = datetime.now()
        return self.db.query(CouponDB).filter(
            CouponDB.is_active == True,
            CouponDB.expires_at > now
        ).all()
    
    def update_coupon(self, coupon_id: str, update_data: dict) -> CouponDB:
        db_coupon = self.get_coupon(coupon_id)
        if db_coupon:
            for key, value in update_data.items():
                if hasattr(db_coupon, key) and value is not None:
                    if key == "location":
                        db_coupon.lat = value["lat"]
                        db_coupon.lng = value["lng"]
                    else:
                        setattr(db_coupon, key, value)
            self.db.commit()
            self.db.refresh(db_coupon)
        return db_coupon
    
    def delete_coupon(self, coupon_id: str) -> bool:
        db_coupon = self.get_coupon(coupon_id)
        if db_coupon:
            self.db.delete(db_coupon)
            self.db.commit()
            return True
        return False
    
    def update_coupon_discount(self, coupon_id: str, new_discount: int):
        db_coupon = self.get_coupon(coupon_id)
        if db_coupon:
            db_coupon.current_discount = new_discount
            self.db.commit()

class UserCouponRepository:
    def __init__(self, db: Session):
        self.db = db
    
    def create_user_coupon(self, user_coupon_data: dict) -> UserCouponDB:
        db_user_coupon = UserCouponDB(
            id=str(uuid.uuid4()),
            coupon_id=user_coupon_data["coupon_id"],
            user_id=user_coupon_data["user_id"],
            shop_name=user_coupon_data["shop_name"],
            title=user_coupon_data["title"],
            discount=user_coupon_data["discount"],
            obtained_at=datetime.now()
        )
        self.db.add(db_user_coupon)
        self.db.commit()
        self.db.refresh(db_user_coupon)
        return db_user_coupon
    
    def get_user_coupon(self, user_coupon_id: str) -> UserCouponDB:
        return self.db.query(UserCouponDB).filter(UserCouponDB.id == user_coupon_id).first()
    
    def get_user_coupons(self, user_id: str) -> list[UserCouponDB]:
        return self.db.query(UserCouponDB).filter(UserCouponDB.user_id == user_id).all()
    
    def get_coupon_users(self, coupon_id: str) -> list[UserCouponDB]:
        return self.db.query(UserCouponDB).filter(UserCouponDB.coupon_id == coupon_id).all()
    
    def check_user_has_coupon(self, user_id: str, coupon_id: str) -> bool:
        existing = self.db.query(UserCouponDB).filter(
            UserCouponDB.user_id == user_id,
            UserCouponDB.coupon_id == coupon_id
        ).first()
        return existing is not None
    
    def use_coupon(self, user_coupon_id: str, user_id: str) -> UserCouponDB:
        db_user_coupon = self.db.query(UserCouponDB).filter(
            UserCouponDB.id == user_coupon_id,
            UserCouponDB.user_id == user_id
        ).first()
        
        if db_user_coupon and not db_user_coupon.is_used:
            db_user_coupon.is_used = True
            db_user_coupon.used_at = datetime.now()
            self.db.commit()
            self.db.refresh(db_user_coupon)
        
        return db_user_coupon
    
    def get_all_user_coupons(self) -> list[UserCouponDB]:
        return self.db.query(UserCouponDB).all()

# Helper functions to convert database models to Pydantic models
def db_coupon_to_dict(db_coupon: CouponDB) -> dict:
    return {
        "id": db_coupon.id,
        "shop_name": db_coupon.shop_name,
        "title": db_coupon.title,
        "base_discount": db_coupon.base_discount,
        "current_discount": db_coupon.current_discount,
        "location": {
            "lat": db_coupon.lat,
            "lng": db_coupon.lng
        },
        "expires_at": db_coupon.expires_at,
        "created_at": db_coupon.created_at,
        "is_active": db_coupon.is_active
    }

def db_user_coupon_to_dict(db_user_coupon: UserCouponDB) -> dict:
    return {
        "id": db_user_coupon.id,
        "coupon_id": db_user_coupon.coupon_id,
        "user_id": db_user_coupon.user_id,
        "shop_name": db_user_coupon.shop_name,
        "title": db_user_coupon.title,
        "discount": db_user_coupon.discount,
        "obtained_at": db_user_coupon.obtained_at,
        "is_used": db_user_coupon.is_used,
        "used_at": db_user_coupon.used_at
    }
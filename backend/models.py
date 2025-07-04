from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

# Import database setup from supabase_client
from supabase_client import Base, engine, SessionLocal

# Production-Ready Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    is_active = Column(Boolean, default=True)
    
    # Location history will be tracked separately in GeoPoint table
    # obtained_coupons tracked in UserCoupon table
    
    # Relationships
    user_coupons = relationship("UserCoupon", back_populates="user")
    geo_points = relationship("GeoPoint", back_populates="user")
    reservations = relationship("Reservation", back_populates="user")

class Store(Base):
    __tablename__ = "stores"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)
    logo_url = Column(String)  # For Cloudinary image URLs
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String)
    owner_email = Column(String, nullable=False)  # 1 store per owner
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    coupons = relationship("Coupon", back_populates="store")
    reservations = relationship("Reservation", back_populates="store")

class Coupon(Base):
    __tablename__ = "coupons"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String, ForeignKey("stores.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    discount_rate_initial = Column(Integer, nullable=False)  # Base discount %
    # Dynamic discount schedule stored as JSON
    discount_rate_schedule = Column(JSON)  # [{"time_remain_min": 60, "rate": 20}, {"time_remain_min": 30, "rate": 30}]
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    active_status = Column(String, default="active")  # active / expired / exploded
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Legacy fields for backward compatibility
    current_discount = Column(Integer, nullable=False)  # Current calculated discount
    
    # Relationships
    store = relationship("Store", back_populates="coupons")
    user_coupons = relationship("UserCoupon", back_populates="coupon")

class UserCoupon(Base):
    __tablename__ = "user_coupons"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    coupon_id = Column(String, ForeignKey("coupons.id"), nullable=False)
    obtained_at = Column(DateTime, default=datetime.now)
    used_at = Column(DateTime)
    status = Column(String, default="obtained")  # obtained / used / expired
    discount_at_obtain = Column(Integer, nullable=False)  # Discount rate when obtained
    
    # Relationships
    user = relationship("User", back_populates="user_coupons")
    coupon = relationship("Coupon", back_populates="user_coupons")

class Admin(Base):
    __tablename__ = "admins"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # "store_owner" / "super_admin"
    linked_store_id = Column(String, ForeignKey("stores.id"))  # For store_owner role
    created_at = Column(DateTime, default=datetime.now)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    linked_store = relationship("Store", foreign_keys=[linked_store_id])

class GeoPoint(Base):
    __tablename__ = "geo_points"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.now)
    
    # Relationships
    user = relationship("User", back_populates="geo_points")

class Reservation(Base):
    __tablename__ = "reservations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    store_id = Column(String, ForeignKey("stores.id"), nullable=False)
    date_time = Column(DateTime, nullable=False)
    note = Column(Text)
    status = Column(String, default="pending")  # pending / confirmed / cancelled
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    user = relationship("User", back_populates="reservations")
    store = relationship("Store", back_populates="reservations")

# Note: Table creation and get_db function are handled in supabase_client.py

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
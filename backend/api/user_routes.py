"""
User-related API routes
"""
from fastapi import APIRouter, HTTPException, Depends, Path
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase_client import get_db
from models import User, UserCoupon, Coupon, Store
from auth import get_current_user

router = APIRouter()

# Pydantic models
class UserCouponResponse(BaseModel):
    id: str
    coupon_id: str
    shop_name: str
    title: str
    discount: int
    obtained_at: datetime
    is_used: bool
    used_at: Optional[datetime] = None
    status: str
    description: Optional[str] = None

class UseCouponResponse(BaseModel):
    message: str
    coupon_id: str
    used_at: datetime

class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime
    total_coupons: int
    used_coupons: int

@router.get("/me/coupons", response_model=List[UserCouponResponse])
async def get_user_coupons(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's coupons"""
    
    # Get user coupons with related coupon and store data
    user_coupons = db.query(UserCoupon, Coupon, Store).join(
        Coupon, UserCoupon.coupon_id == Coupon.id
    ).join(
        Store, Coupon.store_id == Store.id
    ).filter(
        UserCoupon.user_id == current_user.id
    ).order_by(UserCoupon.obtained_at.desc()).all()
    
    result = []
    for user_coupon, coupon, store in user_coupons:
        # Check if coupon is expired
        now = datetime.now()
        is_expired = coupon.end_time <= now and user_coupon.status != "used"
        
        # Update status if expired
        if is_expired and user_coupon.status == "obtained":
            user_coupon.status = "expired"
            db.commit()
        
        result.append(UserCouponResponse(
            id=user_coupon.id,
            coupon_id=user_coupon.coupon_id,
            shop_name=store.name,
            title=coupon.title,
            discount=user_coupon.discount_at_obtain,
            obtained_at=user_coupon.obtained_at,
            is_used=user_coupon.status == "used",
            used_at=user_coupon.used_at,
            status=user_coupon.status,
            description=coupon.description
        ))
    
    return result

@router.post("/me/coupons/{coupon_id}/use", response_model=UseCouponResponse)
async def use_coupon(
    coupon_id: str = Path(..., description="Coupon ID to use"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Use a coupon"""
    
    # Find the user's coupon
    user_coupon = db.query(UserCoupon).filter(
        UserCoupon.user_id == current_user.id,
        UserCoupon.coupon_id == coupon_id
    ).first()
    
    if not user_coupon:
        raise HTTPException(
            status_code=404,
            detail="クーポンが見つかりません"
        )
    
    # Check if already used
    if user_coupon.status == "used":
        raise HTTPException(
            status_code=400,
            detail="このクーポンは既に使用済みです"
        )
    
    # Check if expired
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if coupon and coupon.end_time <= datetime.now():
        user_coupon.status = "expired"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="このクーポンは期限切れです"
        )
    
    # Mark as used
    try:
        user_coupon.status = "used"
        user_coupon.used_at = datetime.now()
        db.commit()
        
        return UseCouponResponse(
            message="クーポンを使用しました",
            coupon_id=coupon_id,
            used_at=user_coupon.used_at
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="クーポンの使用に失敗しました"
        )

@router.get("/me/profile", response_model=UserProfile)
async def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user profile with statistics"""
    
    # Count total and used coupons
    total_coupons = db.query(UserCoupon).filter(
        UserCoupon.user_id == current_user.id
    ).count()
    
    used_coupons = db.query(UserCoupon).filter(
        UserCoupon.user_id == current_user.id,
        UserCoupon.status == "used"
    ).count()
    
    return UserProfile(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        created_at=current_user.created_at,
        total_coupons=total_coupons,
        used_coupons=used_coupons
    )

# Legacy routes for backward compatibility
@router.get("/{user_id}/coupons", response_model=List[UserCouponResponse])
async def get_user_coupons_by_id(
    user_id: str = Path(..., description="User ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user coupons by ID (legacy route)"""
    
    # Check if user is requesting their own coupons or is admin
    if current_user.id != user_id:
        # For now, only allow users to see their own coupons
        # In future, add admin role check here
        raise HTTPException(
            status_code=403,
            detail="他のユーザーのクーポンは閲覧できません"
        )
    
    return await get_user_coupons(current_user, db)

@router.post("/{user_id}/coupons/{coupon_id}/use", response_model=UseCouponResponse)
async def use_coupon_by_id(
    user_id: str = Path(..., description="User ID"),
    coupon_id: str = Path(..., description="Coupon ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Use a coupon by ID (legacy route)"""
    
    # Check if user is using their own coupon
    if current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail="他のユーザーのクーポンは使用できません"
        )
    
    return await use_coupon(coupon_id, current_user, db)
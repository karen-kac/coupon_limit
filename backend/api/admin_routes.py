"""
Admin API routes for store management and coupon administration
"""
from fastapi import APIRouter, HTTPException, Depends, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase_client import get_db
from models import User, Store, Coupon, UserCoupon, Admin
from auth import get_password_hash, verify_password, create_access_token, verify_token

router = APIRouter()
security = HTTPBearer()

# Pydantic models for admin authentication
class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class AdminRegister(BaseModel):
    email: EmailStr
    password: str
    role: str = "store_owner"  # Default to store_owner
    linked_store_id: Optional[str] = None
    registration_code: Optional[str] = None  # For super admin registration

class AdminResponse(BaseModel):
    id: str
    email: str
    role: str
    linked_store_id: Optional[str]
    is_active: bool

class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str
    admin: AdminResponse

# Store management models
class StoreCreate(BaseModel):
    name: str
    description: Optional[str] = None
    latitude: float
    longitude: float
    address: Optional[str] = None

class StoreResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    latitude: float
    longitude: float
    address: Optional[str]
    owner_email: str
    created_at: datetime
    is_active: bool

class CouponCreate(BaseModel):
    store_id: str
    title: str
    description: Optional[str] = None
    discount_rate_initial: int
    start_time: str  # ISO format datetime string
    end_time: str    # ISO format datetime string
    discount_rate_schedule: Optional[List[dict]] = None  # [{"time_remain_min": 60, "rate": 20}]

class CouponResponse(BaseModel):
    id: str
    store_id: str
    store_name: str
    title: str
    description: Optional[str]
    discount_rate_initial: int
    current_discount: int
    start_time: datetime
    end_time: datetime
    active_status: str
    created_at: datetime

class AdminStats(BaseModel):
    total_stores: int
    total_coupons: int
    active_coupons: int
    total_users: int
    coupons_obtained_today: int

class UserCouponDetail(BaseModel):
    id: str
    user_name: str
    user_email: str
    coupon_title: str
    store_name: str
    discount: int
    obtained_at: datetime
    status: str
    used_at: Optional[datetime]

def get_current_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> Admin:
    """Get current admin user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="管理者認証が必要です",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise credentials_exception
    
    admin_id: str = payload.get("sub")
    user_type: str = payload.get("type")
    
    if admin_id is None or user_type != "admin":
        raise credentials_exception
    
    admin = db.query(Admin).filter(
        Admin.id == admin_id,
        Admin.is_active == True
    ).first()
    
    if not admin:
        raise credentials_exception
    
    return admin

# Admin authentication endpoints
@router.post("/auth/register", response_model=AdminTokenResponse)
async def register_admin(admin_data: AdminRegister, db: Session = Depends(get_db)):
    """Admin registration endpoint"""
    
    # Check if admin already exists
    existing_admin = db.query(Admin).filter(Admin.email == admin_data.email).first()
    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このメールアドレスは既に登録されています"
        )
    
    # Validate registration code for super admin
    if admin_data.role == "super_admin":
        # Super admin registration requires a special code
        expected_code = os.getenv("SUPER_ADMIN_REGISTRATION_CODE", "SUPER_ADMIN_2024")
        if admin_data.registration_code != expected_code:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="スーパー管理者登録にはリリースキーが必要です"
            )
    
    # Validate store_id for store_owner
    if admin_data.role == "store_owner":
        if admin_data.linked_store_id:
            store = db.query(Store).filter(Store.id == admin_data.linked_store_id).first()
            if not store:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="指定された店舗が見つかりません"
                )
            
            # Check if store already has an owner
            existing_owner = db.query(Admin).filter(
                Admin.linked_store_id == admin_data.linked_store_id,
                Admin.role == "store_owner"
            ).first()
            if existing_owner:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="この店舗には既にオーナーが設定されています"
                )
    
    try:
        # Create new admin
        new_admin = Admin(
            email=admin_data.email,
            password_hash=get_password_hash(admin_data.password),
            role=admin_data.role,
            linked_store_id=str(admin_data.linked_store_id) if admin_data.linked_store_id else None,
            is_active=True
        )
        
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        
        # Create access token
        access_token = create_access_token(
            data={"sub": str(new_admin.id), "type": "admin", "admin_id": str(new_admin.id)}
        )
        
        admin_response = AdminResponse(
            id=str(new_admin.id),
            email=new_admin.email,
            role=new_admin.role,
            linked_store_id=new_admin.linked_store_id,
            is_active=new_admin.is_active
        )
        
        return AdminTokenResponse(
            access_token=access_token,
            token_type="bearer",
            admin=admin_response
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="管理者アカウントの作成に失敗しました"
        )

@router.post("/auth/login", response_model=AdminTokenResponse)
async def login_admin(admin_data: AdminLogin, db: Session = Depends(get_db)):
    """Admin login endpoint"""
    
    # Find admin by email
    admin = db.query(Admin).filter(Admin.email == admin_data.email).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません"
        )
    
    # Verify password
    if not verify_password(admin_data.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="メールアドレスまたはパスワードが正しくありません"
        )
    
    # Check if admin is active
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理者アカウントが無効になっています"
        )
    
    # Create access token with admin type
    access_token = create_access_token(
        data={"sub": str(admin.id), "type": "admin", "admin_id": str(admin.id)}
    )
    
    admin_response = AdminResponse(
        id=str(admin.id),
        email=admin.email,
        role=admin.role,
        linked_store_id=str(admin.linked_store_id) if admin.linked_store_id else None,
        is_active=admin.is_active
    )
    
    return AdminTokenResponse(
        access_token=access_token,
        token_type="bearer",
        admin=admin_response
    )

@router.get("/auth/me", response_model=AdminResponse)
async def get_current_admin_user_info(current_admin: Admin = Depends(get_current_admin_user)):
    """Get current admin information"""
    return AdminResponse(
        id=str(current_admin.id),
        email=current_admin.email,
        role=current_admin.role,
        linked_store_id=str(current_admin.linked_store_id) if current_admin.linked_store_id else None,
        is_active=current_admin.is_active
    )

@router.get("/auth/verify")
@router.post("/auth/verify")
async def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify if the provided admin token is valid"""
    try:
        token = credentials.credentials
        payload = verify_token(token)
        if payload and payload.get("type") == "admin":
            return {"valid": True, "admin_id": payload.get("admin_id")}
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="無効なトークンです"
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="トークンの検証に失敗しました"
        )

@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    admin: Admin = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get admin dashboard statistics"""
    
    # Basic counts
    total_stores = db.query(Store).filter(Store.is_active == True).count()
    total_coupons = db.query(Coupon).count()
    active_coupons = db.query(Coupon).filter(
        Coupon.active_status == "active",
        Coupon.end_time > datetime.now()
    ).count()
    total_users = db.query(User).filter(User.is_active == True).count()
    
    # Coupons obtained today
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    coupons_obtained_today = db.query(UserCoupon).filter(
        UserCoupon.obtained_at >= today
    ).count()
    
    return AdminStats(
        total_stores=total_stores,
        total_coupons=total_coupons,
        active_coupons=active_coupons,
        total_users=total_users,
        coupons_obtained_today=coupons_obtained_today
    )

@router.get("/stores", response_model=List[StoreResponse])
async def get_stores(
    admin: Admin = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all stores (super admin) or linked store (store owner)"""
    
    if admin.role == "super_admin":
        stores = db.query(Store).all()
    elif admin.role == "store_owner":
        stores = db.query(Store).filter(Store.id == admin.linked_store_id).all()
    else:
        raise HTTPException(status_code=403, detail="無効な管理者権限です")
    
    return [StoreResponse(
        id=str(store.id),
        name=store.name,
        description=store.description,
        latitude=store.latitude,
        longitude=store.longitude,
        address=store.address,
        owner_email=store.owner_email,
        created_at=store.created_at,
        is_active=store.is_active
    ) for store in stores]

@router.post("/stores", response_model=StoreResponse)
async def create_store(
    store_data: StoreCreate,
    admin: Admin = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new store"""
    
    if admin.role not in ["super_admin", "store_owner"]:
        raise HTTPException(status_code=403, detail="管理者権限が必要です")
    
    try:
        # Validate required fields
        if not store_data.name or not store_data.name.strip():
            raise HTTPException(status_code=400, detail="店舗名は必須です")
        
        if store_data.latitude is None or store_data.longitude is None:
            raise HTTPException(status_code=400, detail="緯度と経度は必須です")
        
        if not (-90 <= store_data.latitude <= 90):
            raise HTTPException(status_code=400, detail="緯度は-90から90の間で入力してください")
        
        if not (-180 <= store_data.longitude <= 180):
            raise HTTPException(status_code=400, detail="経度は-180から180の間で入力してください")
        
        new_store = Store(
            name=store_data.name.strip(),
            description=store_data.description.strip() if store_data.description else None,
            latitude=store_data.latitude,
            longitude=store_data.longitude,
            address=store_data.address.strip() if store_data.address else None,
            owner_email=admin.email  # For now, use admin's email
        )
        
        db.add(new_store)
        db.commit()
        db.refresh(new_store)
        
        # Link store to admin if they don't have one yet and are store owner
        if admin.role == "store_owner" and not admin.linked_store_id:
            admin.linked_store_id = str(new_store.id)
            db.commit()
        
        return StoreResponse(
            id=str(new_store.id),
            name=new_store.name,
            description=new_store.description,
            latitude=new_store.latitude,
            longitude=new_store.longitude,
            address=new_store.address,
            owner_email=new_store.owner_email,
            created_at=new_store.created_at,
            is_active=new_store.is_active
        )
        
    except Exception as e:
        db.rollback()
        print(f"Store creation error: {str(e)}")  # サーバーログに詳細を出力
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"店舗の作成に失敗しました: {str(e)}")

@router.get("/coupons", response_model=List[CouponResponse])
async def get_coupons(
    admin: Admin = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get all coupons for admin"""
    
    if admin.role == "super_admin":
        # Super admin can see all coupons
        coupons = db.query(Coupon, Store).join(
            Store, Coupon.store_id == Store.id
        ).all()
    elif admin.role == "store_owner":
        # Store owner can only see their store's coupons
        coupons = db.query(Coupon, Store).join(
            Store, Coupon.store_id == Store.id
        ).filter(Store.id == admin.linked_store_id).all()
    else:
        raise HTTPException(status_code=403, detail="無効な管理者権限です")
    
    return [CouponResponse(
        id=str(coupon.id),
        store_id=str(coupon.store_id),
        store_name=store.name,
        title=coupon.title,
        description=coupon.description,
        discount_rate_initial=coupon.discount_rate_initial,
        current_discount=coupon.current_discount,
        start_time=coupon.start_time,
        end_time=coupon.end_time,
        active_status=coupon.active_status,
        created_at=coupon.created_at
    ) for coupon, store in coupons]

@router.post("/coupons", response_model=CouponResponse)
async def create_coupon(
    coupon_data: CouponCreate,
    admin: Admin = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Create a new coupon"""
    
    # Check if admin can create coupons for this store
    if admin.role == "store_owner" and coupon_data.store_id != admin.linked_store_id:
        raise HTTPException(
            status_code=403,
            detail="自分の店舗のクーポンのみ作成できます"
        )
    
    # Verify store exists
    store = db.query(Store).filter(Store.id == coupon_data.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="店舗が見つかりません")
    
    try:
        # Parse datetime strings
        start_time = datetime.fromisoformat(coupon_data.start_time.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(coupon_data.end_time.replace('Z', '+00:00'))
        
        # Validate times
        if start_time >= end_time:
            raise HTTPException(status_code=400, detail="開始時間は終了時間より前である必要があります")
        
        new_coupon = Coupon(
            store_id=coupon_data.store_id,
            title=coupon_data.title,
            description=coupon_data.description,
            discount_rate_initial=coupon_data.discount_rate_initial,
            current_discount=coupon_data.discount_rate_initial,
            start_time=start_time,
            end_time=end_time,
            active_status="active",
            discount_rate_schedule=coupon_data.discount_rate_schedule
        )
        
        db.add(new_coupon)
        db.commit()
        db.refresh(new_coupon)
        
        return CouponResponse(
            id=str(new_coupon.id),
            store_id=str(new_coupon.store_id),
            store_name=store.name,
            title=new_coupon.title,
            description=new_coupon.description,
            discount_rate_initial=new_coupon.discount_rate_initial,
            current_discount=new_coupon.current_discount,
            start_time=new_coupon.start_time,
            end_time=new_coupon.end_time,
            active_status=new_coupon.active_status,
            created_at=new_coupon.created_at
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="クーポンの作成に失敗しました")

@router.delete("/coupons/{coupon_id}")
async def delete_coupon(
    coupon_id: str,
    hard_delete: bool = False,
    admin: Admin = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Delete a coupon (soft delete by default, hard delete if specified)"""
    
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="クーポンが見つかりません")
    
    # Check permissions
    if admin.role == "store_owner" and coupon.store_id != admin.linked_store_id:
        raise HTTPException(
            status_code=403,
            detail="自分の店舗のクーポンのみ削除できます"
        )
    
    # Only super_admin can perform hard delete
    if hard_delete and admin.role != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="完全削除はスーパー管理者のみ実行できます"
        )
    
    try:
        if hard_delete:
            # Hard delete - completely remove from database
            # First delete related user_coupons
            from models import UserCoupon
            db.query(UserCoupon).filter(UserCoupon.coupon_id == coupon_id).delete()
            
            # Then delete the coupon itself
            db.delete(coupon)
            db.commit()
            
            return {"message": "クーポンを完全削除しました", "coupon_id": coupon_id, "hard_delete": True}
        else:
            # Soft delete by setting status to expired
            coupon.active_status = "expired"
            db.commit()
            
            return {"message": "クーポンを削除しました", "coupon_id": coupon_id, "hard_delete": False}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="クーポンの削除に失敗しました")

@router.get("/coupons/{coupon_id}/users", response_model=List[UserCouponDetail])
async def get_coupon_users(
    coupon_id: str,
    admin: Admin = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Get users who obtained a specific coupon"""
    
    # Verify coupon exists and admin has permission
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="クーポンが見つかりません")
    
    if admin.role == "store_owner" and coupon.store_id != admin.linked_store_id:
        raise HTTPException(
            status_code=403,
            detail="自分の店舗のクーポンのみ閲覧できます"
        )
    
    # Get user coupons with user and store info
    user_coupons = db.query(UserCoupon, User, Coupon, Store).join(
        User, UserCoupon.user_id == User.id
    ).join(
        Coupon, UserCoupon.coupon_id == Coupon.id
    ).join(
        Store, Coupon.store_id == Store.id
    ).filter(UserCoupon.coupon_id == coupon_id).all()
    
    return [UserCouponDetail(
        id=str(user_coupon.id),
        user_name=user.name,
        user_email=user.email,
        coupon_title=coupon.title,
        store_name=store.name,
        discount=user_coupon.discount_at_obtain,
        obtained_at=user_coupon.obtained_at,
        status=user_coupon.status,
        used_at=user_coupon.used_at
    ) for user_coupon, user, coupon, store in user_coupons]
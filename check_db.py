import os
import sys
sys.path.append('/Users/mai-kac/Desktop/coupon_limit/backend')
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Coupon, Store, UserCoupon, User
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('SUPABASE_DATABASE_URL')
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# すべてのユーザーを確認
users = db.query(User).all()
print(f'Total users: {len(users)}')
for user in users:
    print(f'ID: {user.id}')
    print(f'Name: {user.name}')
    print(f'Email: {user.email}')
    print('---')

# すべてのユーザークーポンを確認
user_coupons = db.query(UserCoupon).all()
print(f'Total user coupons: {len(user_coupons)}')
for uc in user_coupons:
    print(f'ID: {uc.id}')
    print(f'User ID: {uc.user_id}')
    print(f'Coupon ID: {uc.coupon_id}')
    print(f'Status: {uc.status}')
    print(f'Discount: {uc.discount_at_obtain}')
    print(f'Obtained at: {uc.obtained_at}')
    print('---')

# すべてのクーポンを確認
coupons = db.query(Coupon).all()
print(f'Total coupons: {len(coupons)}')
for coupon in coupons:
    print(f'ID: {coupon.id}')
    print(f'Title: {coupon.title}')
    print(f'Store ID: {coupon.store_id}')
    print(f'Status: {coupon.active_status}')
    print(f'Start: {coupon.start_time}')
    print(f'End: {coupon.end_time}')
    print('---')

# すべての店舗を確認
stores = db.query(Store).all()
print(f'Total stores: {len(stores)}')
for store in stores:
    print(f'ID: {store.id}')
    print(f'Name: {store.name}')
    print(f'Location: {store.latitude}, {store.longitude}')
    print('---')

db.close() 
import sys
sys.path.append('/Users/mai-kac/Desktop/coupon_limit/backend')

from supabase_client import SessionLocal
from models import UserCoupon, User, Coupon, Store

# Test the SQL query from admin_routes.py
db = SessionLocal()

coupon_id = '87a0082c-fd9b-438a-8000-dbf7832af63d'

print(f"Testing query for coupon ID: {coupon_id}")

# This is the same query from admin_routes.py get_coupon_users function
user_coupons = db.query(UserCoupon, User, Coupon, Store).join(
    User, UserCoupon.user_id == User.id
).join(
    Coupon, UserCoupon.coupon_id == Coupon.id
).join(
    Store, Coupon.store_id == Store.id
).filter(UserCoupon.coupon_id == coupon_id).all()

print(f"Found {len(user_coupons)} user coupons")

for user_coupon, user, coupon, store in user_coupons:
    print(f"User: {user.name} ({user.email})")
    print(f"Coupon: {coupon.title}")
    print(f"Store: {store.name}")
    print(f"Discount: {user_coupon.discount_at_obtain}%")
    print(f"Status: {user_coupon.status}")
    print(f"Obtained at: {user_coupon.obtained_at}")
    print("---")

db.close() 
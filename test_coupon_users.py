import sys
sys.path.append('/Users/mai-kac/Desktop/coupon_limit/backend')

from fastapi.testclient import TestClient
from server import app
from auth import create_access_token
from supabase_client import SessionLocal
from models import Admin

# Create test client
client = TestClient(app)

# Get admin token for super admin
db = SessionLocal()
admin = db.query(Admin).filter(Admin.role == 'super_admin').first()

if admin:
    token = create_access_token({'sub': str(admin.id), 'type': 'admin'})
    headers = {'Authorization': f'Bearer {token}'}
    
    # Test the problematic coupon ID
    coupon_id = '87a0082c-fd9b-438a-8000-dbf7832af63d'
    response = client.get(f'/api/admin/coupons/{coupon_id}/users', headers=headers)
    
    print(f'Status Code: {response.status_code}')
    print(f'Response: {response.json()}')
else:
    print('No super admin found')

db.close() 
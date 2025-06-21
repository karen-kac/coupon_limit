"""
Vercel Serverless Function Entry Point
Main API handler for all routes
"""
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import sys

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth_routes import router as auth_router
from coupon_routes import router as coupon_router
from admin_routes import router as admin_router
from user_routes import router as user_router
from supabase_client import init_database, check_database_connection
from models import get_db, Store
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

# Initialize FastAPI app
app = FastAPI(
    title="Coupon Limit API",
    description="Location-based coupon distribution system",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS Configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Add routers
app.include_router(auth_router, prefix="/api/auth", tags=["authentication"])
app.include_router(coupon_router, prefix="/api/coupons", tags=["coupons"])
app.include_router(user_router, prefix="/api/user", tags=["users"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])

@app.on_event("startup")
async def startup_event():
    """Initialize database and create sample data if needed"""
    try:
        init_database()
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        # Don't fail startup - let the app handle DB errors gracefully

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    db_status = check_database_connection()
    return {
        "status": "healthy" if db_status else "unhealthy",
        "database": "connected" if db_status else "disconnected",
        "version": "1.0.0"
    }

@app.get("/api")
async def root():
    """Root API endpoint"""
    return {
        "message": "Coupon Limit API",
        "version": "1.0.0",
        "docs": "/api/docs",
        "health": "/api/health"
    }

@app.get("/api/coupons/simple-test")
async def simple_coupon_test():
    """Simple test endpoint without database dependency"""
    from datetime import datetime, timedelta
    
    mock_coupons = [
        {
            "id": "test_tokyo_1",
            "shop_name": "東京駅周辺店舗",
            "title": "テスト用クーポン 40% OFF",
            "current_discount": 40,
            "location": {"lat": 35.6812, "lng": 139.7671},
            "expires_at": (datetime.now() + timedelta(hours=2)).isoformat(),
            "time_remaining_minutes": 120,
            "distance_meters": 100,
            "description": "これは動作確認用のテストクーポンです",
            "source": "external",
            "store_name": "東京駅周辺店舗"
        },
        {
            "id": "test_shibuya_1", 
            "shop_name": "渋谷テスト店",
            "title": "テスト用クーポン 30% OFF",
            "current_discount": 30,
            "location": {"lat": 35.6598, "lng": 139.7006},
            "expires_at": (datetime.now() + timedelta(hours=3)).isoformat(),
            "time_remaining_minutes": 180,
            "distance_meters": 500,
            "description": "これは動作確認用のテストクーポンです",
            "source": "external", 
            "store_name": "渋谷テスト店"
        }
    ]
    
    return {"external_coupons": mock_coupons, "count": len(mock_coupons)}

# Public endpoints for registration
class PublicStoreResponse(BaseModel):
    id: str
    name: str
    description: str = None

@app.get("/api/stores/public", response_model=List[PublicStoreResponse])
async def get_public_stores(db: Session = Depends(get_db)):
    """Get public store list for registration (no authentication required)"""
    try:
        stores = db.query(Store).filter(Store.is_active == True).all()
        return [PublicStoreResponse(
            id=store.id,
            name=store.name,
            description=store.description
        ) for store in stores]
    except Exception as e:
        # Return empty list if database is not available
        return []

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "status_code": 500}
    )

# For Vercel
def handler(request, context):
    """Vercel serverless function handler"""
    return app(request, context)

# Export app for Vercel
def main():
    return app

# For local development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
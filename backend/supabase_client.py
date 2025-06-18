"""
Supabase client configuration for production deployment
"""
import os
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
import psycopg2
from urllib.parse import urlparse
from supabase import create_client, Client

# Environment-based database configuration
def get_database_url() -> str:
    """Get database URL from environment variables"""
    # For production with Supabase
    supabase_url = os.getenv("SUPABASE_DATABASE_URL")
    if supabase_url:
        return supabase_url
    
    # For development
    postgres_url = os.getenv("DATABASE_URL")
    if postgres_url:
        return postgres_url
    
    # No SQLite fallback - always use PostgreSQL/Supabase
    raise ValueError("No PostgreSQL database URL found. Please set SUPABASE_DATABASE_URL or DATABASE_URL environment variable.")

def create_database_engine():
    """Create database engine with appropriate configuration"""
    database_url = get_database_url()
    
    # Always use PostgreSQL/Supabase - no SQLite support
    # Handle postgres:// vs postgresql:// URL schemes
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    
    engine = create_engine(
        database_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=os.getenv("SQL_DEBUG", "false").lower() == "true"
    )
    
    return engine

# Create engine and session
engine = create_database_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database session dependency
def get_db() -> Session:
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Health check function
def check_database_connection() -> bool:
    """Check if database connection is working"""
    try:
        with engine.connect() as connection:
            connection.execute("SELECT 1")
        return True
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

class SupabaseConfig:
    """Supabase configuration class"""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL", "")
        self.anon_key = os.getenv("SUPABASE_ANON_KEY", "")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        self.database_url = os.getenv("SUPABASE_DATABASE_URL", "")
        
    @property
    def is_configured(self) -> bool:
        """Check if Supabase is properly configured"""
        return bool(self.url and self.anon_key and self.database_url)
    
    def get_auth_headers(self) -> dict:
        """Get authentication headers for Supabase API calls"""
        return {
            "apikey": self.anon_key,
            "Authorization": f"Bearer {self.anon_key}",
            "Content-Type": "application/json"
        }
    
    def get_service_headers(self) -> dict:
        """Get service role headers for admin operations"""
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json"
        }

# Global Supabase config instance
supabase_config = SupabaseConfig()

# Supabase client helper
def get_supabase_client() -> Client:
    """Create and return a Supabase client instance"""
    if not supabase_config.url:
        raise ValueError("SUPABASE_URL is not configured")
    api_key = supabase_config.service_role_key or supabase_config.anon_key
    if not api_key:
        raise ValueError("Supabase API key is not configured")
    return create_client(supabase_config.url, api_key)

def check_supabase_connection() -> bool:
    """Check whether Supabase API is reachable"""
    try:
        client = get_supabase_client()
        client.table("users").select("id").limit(1).execute()
        return True
    except Exception as e:
        print(f"Supabase connection failed: {e}")
        return False

# Database initialization function
def init_database():
    """Initialize database tables"""
    try:
        # Import models to register them with Base
        # Import here to avoid circular imports
        import models
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("Database tables initialized successfully")
        
        # Create sample data if needed
        if os.getenv("CREATE_SAMPLE_DATA", "false").lower() == "true":
            create_sample_data()
            
    except Exception as e:
        print(f"Database initialization failed: {e}")
        raise

def create_sample_data():
    """Create sample data for development"""
    from models import Store, Admin
    from auth import get_password_hash
    
    db = SessionLocal()
    try:
        # Check if sample data already exists
        existing_stores = db.query(Store).count()
        if existing_stores > 0:
            print("Sample data already exists, skipping creation")
            return
        
        # Create sample stores
        sample_stores = [
            {
                "name": "東京駅コーヒーショップ",
                "description": "美味しいコーヒーとパンの店",
                "latitude": 35.6812,
                "longitude": 139.7671,
                "address": "東京都千代田区丸の内1-1-1",
                "owner_email": "coffee@example.com"
            },
            {
                "name": "銀座レストラン", 
                "description": "本格的な和食レストラン",
                "latitude": 35.6762,
                "longitude": 139.7653,
                "address": "東京都中央区銀座1-1-1",
                "owner_email": "restaurant@example.com"
            },
            {
                "name": "新宿書店",
                "description": "本とカフェの複合店", 
                "latitude": 35.6896,
                "longitude": 139.7006,
                "address": "東京都新宿区新宿1-1-1",
                "owner_email": "bookstore@example.com"
            }
        ]
        
        created_stores = []
        for store_data in sample_stores:
            store = Store(**store_data)
            db.add(store)
            created_stores.append(store)
        
        db.commit()
        
        # Create sample admin users
        sample_admins = [
            {
                "email": "admin@couponlimit.com",
                "password_hash": get_password_hash("admin123"),
                "role": "super_admin",
                "linked_store_id": None
            }
        ]
        
        # Create store owner admins
        for i, store in enumerate(created_stores):
            sample_admins.append({
                "email": store.owner_email,
                "password_hash": get_password_hash(f"store{i+1}123"),
                "role": "store_owner",
                "linked_store_id": store.id
            })
        
        for admin_data in sample_admins:
            admin = Admin(**admin_data)
            db.add(admin)
        
        db.commit()
        print(f"Created {len(sample_stores)} sample stores and {len(sample_admins)} admin users")
        
    except Exception as e:
        db.rollback()
        print(f"Failed to create sample data: {e}")
    finally:
        db.close()

# Export commonly used items
__all__ = [
    'engine',
    'SessionLocal', 
    'Base',
    'get_db',
    'supabase_config',
    'init_database',
    'check_database_connection',
    'get_supabase_client',
    'check_supabase_connection'
]
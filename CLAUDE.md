# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a location-based coupon distribution system that allows users to obtain time-limited coupons when they are within 20m of participating stores. Built as a web application with React frontend, Python FastAPI backend, and SQLite database.

## Key Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Location**: `/frontend/` directory
- **Entry Point**: `src/App.tsx`
- **Key Components**:
  - `MapView.tsx` - Google Maps integration and coupon display
  - `CouponPopup.tsx` - Coupon detail modal
  - `MyPage.tsx` - User's coupon history
  - `Login.tsx` / `Register.tsx` - Authentication
  - `ExplosionEffect.tsx` - Animated coupon expiration effects

### Backend (Python FastAPI)
- **Framework**: FastAPI with SQLAlchemy
- **Location**: `/backend/` directory  
- **Entry Point**: `main.py`
- **Key Files**:
  - `models.py` - Database models (User, Store, Coupon, etc.)
  - `database.py` - Database connection and repository patterns
  - `auth.py` - JWT authentication system
  - `repositories.py` - Data access layer

### Admin Panel
- **Location**: `/admin/` directory
- **Technology**: Vanilla HTML/CSS/JS
- **Purpose**: Store management and coupon creation interface

## Development Commands

### Backend Setup and Running
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py  # Runs on http://localhost:8000
```

### Frontend Setup and Running
```bash
cd frontend
npm install
npm start  # Runs on http://localhost:3000
```

### Testing
```bash
# Frontend tests
cd frontend
npm test

# Backend testing
cd backend
python -m pytest  # If pytest is added to requirements
```

## Database Architecture

### Technology Stack
- **Database**: SQLite (`backend/coupon_app.db`)
- **ORM**: SQLAlchemy with declarative base
- **Pattern**: Repository pattern for data access

### Key Models
- **User**: Authentication and profile management
- **Store**: Store locations and metadata
- **Coupon**: Time-limited offers with dynamic discount rates
- **UserCoupon**: Junction table tracking user's obtained coupons
- **Admin**: Store owner and super admin roles
- **GeoPoint**: User location tracking
- **Reservation**: Store reservation system

### Dynamic Discount System
Coupons support time-based discount escalation through JSON scheduling stored in `discount_rate_schedule` field.

## API Structure

### User Endpoints
- `GET /api/coupons?lat={lat}&lng={lng}&radius={radius}` - Get nearby coupons
- `POST /api/coupons/get` - Obtain a coupon
- `GET /api/user/{user_id}/coupons` - User's coupon history
- `POST /api/user/{user_id}/coupons/{coupon_id}/use` - Use a coupon

### Admin Endpoints  
- `POST /api/admin/coupons` - Create coupon
- `GET /api/admin/coupons` - List all coupons
- `PUT /api/admin/coupons/{id}` - Update coupon
- `DELETE /api/admin/coupons/{id}` - Delete coupon
- `GET /api/admin/stats` - Get statistics

### Authentication
- JWT-based authentication system
- User registration and login endpoints
- Role-based access control for admin functions

## Core Business Logic

### Location-Based Coupon Distribution
- Users must be within 20m radius to obtain coupons
- Uses Haversine formula for distance calculation
- Real-time location tracking via browser Geolocation API

### Time-Based Discount Escalation
- Discount rates increase as expiration approaches
- Configurable schedule per coupon (JSON format)
- Real-time updates in frontend interface

### Coupon Lifecycle
1. **Active**: Available for discovery and obtaining
2. **Obtained**: User has claimed the coupon
3. **Used**: Coupon has been redeemed
4. **Expired**: Past expiration time with explosion animation

## Environment Setup

### Required Environment Variables
```bash
# Frontend (.env in /frontend directory)
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Backend environment variables (if needed)
DATABASE_URL=sqlite:///coupon_app.db
SECRET_KEY=your_jwt_secret_key
```

## Development Notes

### Sample Data
- Backend automatically creates sample coupons around Tokyo Station on first run
- Database resets by deleting `backend/coupon_app.db` file

### Testing the System
1. Start backend server
2. Start frontend development server  
3. Open browser and allow location permissions
4. Navigate near sample locations or modify coordinates for testing

### Admin Panel Access
1. Ensure backend is running
2. Open `admin/index.html` directly in browser
3. Uses backend API endpoints for management functions
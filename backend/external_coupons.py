"""
External Coupon Service
Fetches coupons from external APIs like Kumapon and integrates them into our system
"""
import requests
import json
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import uuid
from models import Coupon
import logging

logger = logging.getLogger(__name__)

class ExternalCouponService:
    """Service for fetching and integrating external coupons"""
    
    def __init__(self):
        self.kumapon_base_url = "https://api.kumapon.jp"
        
    async def fetch_kumapon_areas(self) -> List[Dict]:
        """Fetch available areas from Kumapon API"""
        try:
            response = requests.get(f"{self.kumapon_base_url}/area_groups.json", timeout=10)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Kumapon areas response: {data}")
            
            # Handle different response formats based on API documentation
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                # Check for area_groups key first, then fallback to direct areas
                areas = data.get('area_groups', data.get('areas', []))
                if not areas and 'data' in data:
                    areas = data['data']
                return areas if isinstance(areas, list) else []
            else:
                return []
        except requests.RequestException as e:
            logger.error(f"Failed to fetch Kumapon areas: {e}")
            return []
    
    async def fetch_kumapon_area_deals(self, area_id: str) -> List[Dict]:
        """Fetch deals for a specific area using correct API endpoint"""
        try:
            # Use the correct endpoint format based on API documentation
            response = requests.get(f"{self.kumapon_base_url}/area_groups/{area_id}.json", timeout=10)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Kumapon area {area_id} response structure: {list(data.keys()) if isinstance(data, dict) else type(data)}")
            
            deals = []
            
            # Extract deals from the response based on API documentation
            if isinstance(data, dict):
                # Try different possible keys for deals
                if 'deals' in data:
                    deals = data['deals']
                elif 'area_group' in data and isinstance(data['area_group'], dict):
                    deals = data['area_group'].get('deals', [])
                elif 'data' in data:
                    if isinstance(data['data'], dict) and 'deals' in data['data']:
                        deals = data['data']['deals']
                    elif isinstance(data['data'], list):
                        deals = data['data']
            elif isinstance(data, list):
                deals = data
            
            logger.info(f"Found {len(deals)} deals for area {area_id}")
            return deals if isinstance(deals, list) else []
            
        except requests.RequestException as e:
            logger.error(f"Failed to fetch Kumapon deals for area {area_id}: {e}")
            return []
    
    async def fetch_kumapon_coupon(self, coupon_id: str) -> Optional[Dict]:
        """Fetch specific coupon from Kumapon API"""
        try:
            response = requests.get(f"{self.kumapon_base_url}/deals/{coupon_id}.json", timeout=10)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Kumapon coupon {coupon_id} response structure: {list(data.keys()) if isinstance(data, dict) else type(data)}")
            return data
        except requests.RequestException as e:
            logger.error(f"Failed to fetch Kumapon coupon {coupon_id}: {e}")
            return None
    
    def convert_kumapon_to_coupon(self, kumapon_data: Dict, area_lat: float = 35.6762, area_lng: float = 139.6503) -> Optional[Dict]:
        """Convert Kumapon API data to our Coupon format"""
        try:
            # Handle both deal wrapper and direct deal data
            deal = kumapon_data.get('deal', kumapon_data)
            
            # Basic validation
            if not deal.get('title') or not deal.get('id'):
                logger.warning(f"Invalid deal data: missing title or id in {deal}")
                return None
            
            # Extract discount information
            original_price = deal.get('original_price', deal.get('price_original', 0))
            sale_price = deal.get('price', deal.get('sale_price', deal.get('price_sale', 0)))
            discount_rate = 0
            
            if original_price > 0 and sale_price > 0:
                discount_rate = int(((original_price - sale_price) / original_price) * 100)
            elif deal.get('discount_percentage'):
                discount_rate = int(deal.get('discount_percentage', 0))
            else:
                # Try to extract discount from title
                import re
                title = deal.get('title', '')
                discount_match = re.search(r'(\d+)%\s*OFF', title)
                if discount_match:
                    discount_rate = int(discount_match.group(1))
                else:
                    discount_rate = 30  # Default discount if not specified
            
            # Extract merchant/shop information with more comprehensive checks
            merchant = deal.get('merchant', {})
            shop_name = None
            
            # Try multiple fields for shop name
            possible_name_fields = [
                'name', 'merchant_name', 'shop_name', 'store_name', 
                'company_name', 'business_name'
            ]
            
            for field in possible_name_fields:
                if merchant.get(field):
                    shop_name = merchant[field]
                    break
                elif deal.get(field):
                    shop_name = deal[field]
                    break
            
            # If still no shop name, try to extract from title or description
            if not shop_name:
                title = deal.get('title', '')
                
                # Try to extract merchant name from title (common patterns)
                import re
                
                # Pattern 1: 【店舗名】or ≪店舗名≫
                merchant_match = re.search(r'【([^】]+)】|≪([^≫]+)≫', title)
                if merchant_match:
                    shop_name = merchant_match.group(1) or merchant_match.group(2)
                else:
                    # Pattern 2: Extract company/service name before specific keywords
                    # Remove discount info first
                    clean_title = re.sub(r'\d+%\s*OFF', '', title)
                    clean_title = re.sub(r'【[^】]*円[^】]*】', '', clean_title)
                    
                    # Look for service names or company names
                    if '通信講座' in title:
                        # For online courses, extract the course/service name
                        course_match = re.search(r'([^≪【☆★]+?)(通信講座|認定講師|インストラクター)', clean_title)
                        if course_match:
                            course_name = course_match.group(1).strip()
                            # Clean up common prefixes/suffixes
                            course_name = re.sub(r'^(送料無料|☆|★)+', '', course_name).strip()
                            if len(course_name) > 3:
                                shop_name = f"{course_name} オンラインスクール"
                    elif 'リフォーム' in title:
                        shop_name = "リショップナビ"
                    elif 'グリエネ' in title:
                        shop_name = "グリエネ（太陽光発電比較）"
                    elif '見積' in title or '比較' in title:
                        shop_name = "見積もり比較サービス"
                    else:
                        # Extract first meaningful part
                        parts = re.split(r'[≪【☆★]', clean_title)
                        if len(parts) > 0:
                            first_part = parts[0].strip()
                            if len(first_part) > 2:
                                shop_name = first_part[:20]  # Limit length
            
            if not shop_name or shop_name == '店舗名不明':
                # Last resort: use service type based on title content
                title = deal.get('title', '')
                if '通信講座' in title:
                    shop_name = 'オンライン通信講座'
                elif 'アロマ' in title:
                    shop_name = 'アロマスクール'
                elif 'マッサージ' in title:
                    shop_name = 'マッサージスクール'
                elif 'カウンセリング' in title:
                    shop_name = 'カウンセリングスクール'
                elif 'インストラクター' in title:
                    shop_name = 'インストラクター養成講座'
                elif 'ベビー' in title:
                    shop_name = 'ベビー関連講座'
                elif '美容' in title:
                    shop_name = '美容関連講座'
                elif 'リフォーム' in title:
                    shop_name = 'リフォーム見積サービス'
                elif '太陽光' in title:
                    shop_name = '太陽光発電見積サービス'
                else:
                    shop_name = 'オンラインサービス'
            
            # Extract location information with comprehensive checks
            location_data = {}
            address = ''
            
            # Try multiple location sources
            if merchant.get('address'):
                location_data = merchant['address'] if isinstance(merchant['address'], dict) else {}
                if isinstance(merchant['address'], str):
                    address = merchant['address']
            elif deal.get('locations') and len(deal.get('locations', [])) > 0:
                location_data = deal['locations'][0]
            elif deal.get('location'):
                location_data = deal['location']
            elif deal.get('address'):
                if isinstance(deal['address'], dict):
                    location_data = deal['address']
                elif isinstance(deal['address'], str):
                    address = deal['address']
            
            # Extract coordinates
            lat = None
            lng = None
            
            # Try different coordinate field names
            coord_fields = [
                ('latitude', 'longitude'),
                ('lat', 'lng'), 
                ('lat', 'lon'),
                ('y', 'x')
            ]
            
            for lat_field, lng_field in coord_fields:
                if location_data.get(lat_field) is not None and location_data.get(lng_field) is not None:
                    try:
                        lat = float(location_data[lat_field])
                        lng = float(location_data[lng_field])
                        break
                    except (ValueError, TypeError):
                        continue
            
            # If no specific coordinates, use area coordinates with small random offset
            if lat is None or lng is None:
                import random
                lat_offset = random.uniform(-0.01, 0.01)  # ~1km offset
                lng_offset = random.uniform(-0.01, 0.01)
                lat = area_lat + lat_offset
                lng = area_lng + lng_offset
            
            # Extract address string
            if not address:
                address_fields = [
                    'address_line_1', 'address', 'full_address', 
                    'prefecture', 'city', 'street'
                ]
                for field in address_fields:
                    if location_data.get(field):
                        address = location_data[field]
                        break
            
            # Set expiration time
            expires_at = datetime.now() + timedelta(hours=24)
            
            # Try multiple date fields
            date_fields = ['expires_at', 'end_date', 'expiry_date', 'valid_until']
            for field in date_fields:
                if deal.get(field):
                    try:
                        date_str = deal[field]
                        if isinstance(date_str, str):
                            if 'T' in date_str:
                                expires_at = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                            else:
                                expires_at = datetime.strptime(date_str, '%Y-%m-%d')
                        break
                    except:
                        continue
            
            # Try to extract expiration from fine print
            fine_print = deal.get('fine_print', deal.get('description', ''))
            if fine_print and 'まで' in fine_print:
                try:
                    import re
                    date_match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', fine_print)
                    if date_match:
                        year, month, day = date_match.groups()
                        expires_at = datetime(int(year), int(month), int(day))
                except:
                    pass
            
            # Get image URL
            image_url = ''
            if deal.get('images'):
                images = deal['images']
                if isinstance(images, list) and len(images) > 0:
                    img = images[0]
                    if isinstance(img, dict):
                        image_url = img.get('photo_url', img.get('url', img.get('medium', img.get('large', ''))))
                    elif isinstance(img, str):
                        image_url = img
                elif isinstance(images, dict):
                    image_url = images.get('medium', images.get('small', images.get('large', images.get('photo_url', ''))))
            
            # Get deal URL
            deal_url = deal.get('deal_url', deal.get('url', f"https://kumapon.jp/deals/{deal['id']}"))
            
            # Extract description
            description = deal.get('description', deal.get('fine_print', deal.get('summary', '')))
            
            coupon_data = {
                'id': f"kumapon_{deal['id']}",
                'title': deal.get('title', 'クーポン'),
                'description': description,
                'store_name': shop_name,
                'shop_name': shop_name,
                'current_discount': discount_rate,
                'discount_rate_initial': discount_rate,
                'location': {
                    'lat': lat,
                    'lng': lng
                },
                'start_time': datetime.now(),
                'end_time': expires_at,
                'expires_at': expires_at.isoformat(),
                'active_status': 'active',
                'source': 'kumapon',
                'external_id': str(deal['id']),
                'external_url': deal_url,
                'original_price': original_price,
                'sale_price': sale_price,
                'image_url': image_url,
                'address': address,
                'distance_meters': 0  # Will be calculated later
            }
            
            logger.info(f"Converted coupon: {coupon_data['id']} - {coupon_data['shop_name']} - {coupon_data['title'][:50]}...")
            return coupon_data
        
        except Exception as e:
            logger.error(f"Failed to convert Kumapon data: {e}")
            logger.error(f"Original data: {kumapon_data}")
            return None
    
    async def get_external_coupons_near_location(self, lat: float, lng: float, radius: int = 50000000) -> List[Dict]:
        """Get external coupons near a specific location"""
        external_coupons = []
        
        # Fetch from Kumapon
        kumapon_coupons = await self.fetch_kumapon_coupons_near_location(lat, lng, radius)
        external_coupons.extend(kumapon_coupons)
        
        return external_coupons
    
    async def fetch_kumapon_coupons_near_location(self, lat: float, lng: float, radius: int) -> List[Dict]:
        """Fetch Kumapon coupons near specified location"""
        coupons = []
        
        try:
            logger.info(f"Starting Kumapon coupon fetch for location: {lat}, {lng}")
            
            # Get area mapping for the location
            area_mapping = self.get_area_mapping_for_location(lat, lng)
            logger.info(f"Target areas: {area_mapping}")
            
            # Fetch deals from relevant areas
            for area_id in area_mapping:
                try:
                    logger.info(f"Fetching deals for area: {area_id}")
                    
                    # Use the new method to get deals for this area
                    deals = await self.fetch_kumapon_area_deals(area_id)
                    
                    if not deals:
                        logger.warning(f"No deals found for area {area_id}")
                        continue
                    
                    logger.info(f"Found {len(deals)} deals in area {area_id}")
                    
                    # Process up to 20 deals per area
                    for i, deal in enumerate(deals[:20]):
                        try:
                            # If deal is just an ID, fetch full details
                            if isinstance(deal, (str, int)):
                                deal_data = await self.fetch_kumapon_coupon(str(deal))
                                if not deal_data:
                                    continue
                            else:
                                # Deal data is already provided
                                deal_data = deal
                            
                            converted_coupon = self.convert_kumapon_to_coupon(deal_data, lat, lng)
                            if converted_coupon:
                                # Calculate distance
                                distance = self.calculate_distance(
                                    lat, lng,
                                    converted_coupon['location']['lat'],
                                    converted_coupon['location']['lng']
                                )
                                
                                if distance <= radius:
                                    converted_coupon['distance_meters'] = distance
                                    coupons.append(converted_coupon)
                                    logger.info(f"Added coupon: {converted_coupon['id']} - {converted_coupon['shop_name']}")
                                    
                                    # Limit to prevent too many external coupons
                                    if len(coupons) >= 10:
                                        break
                                        
                        except Exception as e:
                            logger.error(f"Failed to process deal {i}: {e}")
                            continue
                    
                    if len(coupons) >= 10:
                        break
                        
                except Exception as e:
                    logger.error(f"Failed to process area {area_id}: {e}")
                    continue
            
            logger.info(f"Successfully fetched {len(coupons)} Kumapon coupons")
                            
        except Exception as e:
            logger.error(f"Failed to fetch Kumapon coupons: {e}")
        
        return coupons
    
    def get_area_mapping_for_location(self, lat: float, lng: float) -> List[str]:
        """Get relevant Kumapon area IDs based on location"""
        # Based on Kumapon API documentation, try common area IDs
        
        # Tokyo area (roughly)
        if 35.5 <= lat <= 35.9 and 139.3 <= lng <= 139.9:
            return ['1', '13', '14']  # Try multiple Tokyo-related IDs
        
        # Osaka area
        elif 34.5 <= lat <= 34.8 and 135.3 <= lng <= 135.7:
            return ['2', '27']  # Osaka area IDs
        
        # Kyoto area
        elif 34.9 <= lat <= 35.1 and 135.6 <= lng <= 135.9:
            return ['26']  # Kyoto area ID
        
        # Nagoya area
        elif 35.0 <= lat <= 35.3 and 136.7 <= lng <= 137.0:
            return ['23']  # Nagoya area ID
        
        # Fukuoka area
        elif 33.5 <= lat <= 33.7 and 130.3 <= lng <= 130.5:
            return ['40']  # Fukuoka area ID
        
        # Default to common area IDs for testing
        else:
            return ['1', '2', '13']
    
    def calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        import math
        
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lng1_rad = math.radians(lng1)
        lat2_rad = math.radians(lat2)
        lng2_rad = math.radians(lng2)
        
        dlat = lat2_rad - lat1_rad
        dlng = lng2_rad - lng1_rad
        
        a = (math.sin(dlat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c

# Mock data for testing when Kumapon API is not available
MOCK_EXTERNAL_COUPONS = [
    {
        'id': 'external_tokyo_1',
        'title': '東京駅周辺レストラン 50% OFF',
        'description': '人気レストランでのお食事が50%オフ！',
        'store_name': '東京グルメプラザ',
        'shop_name': '東京グルメプラザ',
        'current_discount': 50,
        'discount_rate_initial': 50,
        'location': {'lat': 35.6812, 'lng': 139.7671},
        'start_time': datetime.now(),
        'end_time': datetime.now() + timedelta(hours=6),
        'expires_at': (datetime.now() + timedelta(hours=6)).isoformat(),
        'active_status': 'active',
        'source': 'external_mock',
        'external_id': 'mock_1',
        'external_url': 'https://example.com/coupon1',
        'distance_meters': 0
    },
    {
        'id': 'external_shibuya_1',
        'title': '渋谷カフェ 30% OFF ドリンク',
        'description': '全ドリンクメニューが30%オフ',
        'store_name': '渋谷カフェラウンジ',
        'shop_name': '渋谷カフェラウンジ',
        'current_discount': 30,
        'discount_rate_initial': 30,
        'location': {'lat': 35.6598, 'lng': 139.7006},
        'start_time': datetime.now(),
        'end_time': datetime.now() + timedelta(hours=4),
        'expires_at': (datetime.now() + timedelta(hours=4)).isoformat(),
        'active_status': 'active',
        'source': 'external_mock',
        'external_id': 'mock_2',
        'external_url': 'https://example.com/coupon2',
        'distance_meters': 0
    },
    {
        'id': 'external_shinjuku_1',
        'title': '新宿ショッピング 40% OFF',
        'description': 'ファッションアイテム最大40%オフ',
        'store_name': '新宿ファッション館',
        'shop_name': '新宿ファッション館',
        'current_discount': 40,
        'discount_rate_initial': 40,
        'location': {'lat': 35.6896, 'lng': 139.7006},
        'start_time': datetime.now(),
        'end_time': datetime.now() + timedelta(hours=8),
        'expires_at': (datetime.now() + timedelta(hours=8)).isoformat(),
        'active_status': 'active',
        'source': 'external_mock',
        'external_id': 'mock_3',
        'external_url': 'https://example.com/coupon3',
        'distance_meters': 0
    }
]

async def get_mock_external_coupons(lat: float, lng: float, radius: int = 5000) -> List[Dict]:
    """Get mock external coupons for testing"""
    service = ExternalCouponService()
    result_coupons = []
    
    for coupon in MOCK_EXTERNAL_COUPONS:
        # Calculate distance
        distance = service.calculate_distance(
            lat, lng,
            coupon['location']['lat'],
            coupon['location']['lng']
        )
        
        if distance <= radius:
            coupon_copy = coupon.copy()
            coupon_copy['distance_meters'] = distance
            result_coupons.append(coupon_copy)
    
    return result_coupons
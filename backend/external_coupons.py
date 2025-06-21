"""
External Coupon Service
Fetches coupons from external APIs like Kumapon, Hot Pepper and integrates them into our system
"""
import requests
import json
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import uuid
from models import Coupon
import logging
import os

logger = logging.getLogger(__name__)

class ExternalCouponService:
    """Service for fetching and integrating external coupons"""
    
    def __init__(self):
        self.kumapon_base_url = "https://api.kumapon.jp"
        self.hotpepper_base_url = "https://webservice.recruit.co.jp/hotpepper/gourmet/v1/"
        self.hotpepper_api_key = os.getenv("HOTPEPPER_API_KEY", "")  # API key from environment
        
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
            
            # Get deal URL with correct format
            deal_url = deal.get('deal_url', deal.get('url', ''))
            if not deal_url:
                # Generate correct URL format: https://kumapon.jp/deals/20250620kpd256001
                # Use current date if no issue date is available
                issue_date = datetime.now().strftime('%Y%m%d')
                deal_url = f"https://kumapon.jp/deals/{issue_date}kpd{deal['id']}"
            
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
        
        # Fetch from Hot Pepper
        hotpepper_coupons = await self.fetch_hotpepper_coupons_near_location(lat, lng, radius)
        external_coupons.extend(hotpepper_coupons)
        
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

    async def generate_hotpepper_mock_coupons_near_user(self, user_lat: float, user_lng: float, radius: int) -> List[Dict]:
        """Generate Hot Pepper mock coupons near user's location"""
        import random
        
        mock_coupons = []
        
        # Generate 5-8 mock Hot Pepper coupons around user location
        num_coupons = random.randint(5, 8)
        
        # Restaurant types and names for mock data
        restaurant_types = [
            {"genre": "和食", "names": ["海鮮居酒屋 魚心", "日本料理 さくら", "寿司 まつ", "うなぎ 川重"], "emoji": "🍣"},
            {"genre": "イタリアン・フレンチ", "names": ["トラットリア・ベラヴィスタ", "カフェレストラン マルコ", "ビストロ プティ"], "emoji": "🍝"},
            {"genre": "焼肉・韓国料理", "names": ["炭火焼肉 牛角", "韓国料理 ソウル", "焼肉 大将"], "emoji": "🥩"},
            {"genre": "中華", "names": ["中華料理 龍門", "餃子の王将", "四川料理 麻辣"], "emoji": "🥟"},
            {"genre": "カフェ・スイーツ", "names": ["カフェ ドトール", "パティスリー アンジュ", "喫茶店 珈琲館"], "emoji": "☕"},
            {"genre": "ファミリーレストラン", "names": ["ファミレス サイゼリヤ", "デニーズ", "ガスト"], "emoji": "🍽️"}
        ]
        
        for i in range(num_coupons):
            # Random position within radius around user - concentrated near user location
            angle = random.uniform(0, 2 * 3.14159)
            
            # Generate distances with preference for closer locations
            rand = random.random()
            if rand < 0.7:  # 70% within 200m (歩いて2-3分)
                distance_m = random.uniform(30, 200)
            elif rand < 0.9:  # 20% within 200m-500m (歩いて3-6分)
                distance_m = random.uniform(200, 500)
            else:  # 10% within 500m-1000m (歩いて6-12分)
                distance_m = random.uniform(500, min(radius, 1000))
            
            # Convert to lat/lng offset using proper geographic calculation
            import math
            
            # Earth's radius in meters
            R = 6371000
            
            # Convert distance to radians
            distance_rad = distance_m / R
            
            # Calculate new coordinates
            lat1 = math.radians(user_lat)
            lng1 = math.radians(user_lng)
            
            lat2 = math.asin(math.sin(lat1) * math.cos(distance_rad) + 
                           math.cos(lat1) * math.sin(distance_rad) * math.cos(angle))
            lng2 = lng1 + math.atan2(math.sin(angle) * math.sin(distance_rad) * math.cos(lat1),
                                   math.cos(distance_rad) - math.sin(lat1) * math.sin(lat2))
            
            coupon_lat = math.degrees(lat2)
            coupon_lng = math.degrees(lng2)
            
            # Random restaurant type
            restaurant_type = random.choice(restaurant_types)
            shop_name = random.choice(restaurant_type["names"])
            
            # Random discount
            discount_rates = [15, 20, 25, 30]
            discount = random.choice(discount_rates)
            
            # Generate budget
            budgets = ["1000～2000円", "2000～3000円", "3000～4000円", "4000～5000円"]
            budget = random.choice(budgets)
            
            mock_coupon = {
                'id': f'hotpepper_mock_{i+1}_{user_lat:.4f}_{user_lng:.4f}',
                'title': f'{shop_name} - {restaurant_type["genre"]}クーポン',
                'description': f'{restaurant_type["emoji"]} {restaurant_type["genre"]}をお楽しみください',
                'store_name': shop_name,
                'shop_name': shop_name,
                'current_discount': discount,
                'discount_rate_initial': discount,
                'location': {'lat': coupon_lat, 'lng': coupon_lng},
                'start_time': datetime.now(),
                'end_time': datetime.now() + timedelta(days=30),
                'expires_at': (datetime.now() + timedelta(days=30)).isoformat(),
                'active_status': 'active',
                'source': 'hotpepper',
                'external_id': f'hp_mock_{i+1}',
                'external_url': f'https://www.hotpepper.jp/strJ00123456{i+1}/',
                'distance_meters': distance_m,
                'genre': restaurant_type["genre"],
                'budget': budget,
                'access': f'現在地から徒歩{max(1, int(distance_m / 80))}分'  # 80m/分で計算
            }
            
            mock_coupons.append(mock_coupon)
            logger.info(f"Generated mock Hot Pepper coupon: {mock_coupon['id']} - {mock_coupon['shop_name']}")
        
        return mock_coupons

    async def fetch_hotpepper_shops(self, lat: float, lng: float, radius: int = 3000) -> List[Dict]:
        """Fetch shops from Hot Pepper API near specified location"""
        if not self.hotpepper_api_key:
            logger.warning("Hot Pepper API key not configured")
            return []
        
        try:
            # Convert radius from meters to Hot Pepper API range parameter
            # Hot Pepper API uses fixed range values: 1(300m), 2(500m), 3(1000m), 4(2000m), 5(3000m)
            if radius <= 300:
                range_param = 1
            elif radius <= 500:
                range_param = 2
            elif radius <= 1000:
                range_param = 3
            elif radius <= 2000:
                range_param = 4
            else:
                range_param = 5
            
            params = {
                'key': self.hotpepper_api_key,
                'lat': lat,
                'lng': lng,
                'range': range_param,
                'format': 'json',
                'count': 50,  # Maximum results per request
                'order': 4,   # Sort by distance
                'mobile_coupon': 1,  # Only shops with mobile coupons
            }
            
            logger.info(f"Fetching Hot Pepper shops at {lat}, {lng} with range {range_param}")
            
            response = requests.get(self.hotpepper_base_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if 'results' in data and 'shop' in data['results']:
                shops = data['results']['shop']
                logger.info(f"Found {len(shops)} Hot Pepper shops")
                return shops
            else:
                logger.warning("No shops found in Hot Pepper API response")
                return []
                
        except requests.RequestException as e:
            logger.error(f"Failed to fetch Hot Pepper shops: {e}")
            return []
        except Exception as e:
            logger.error(f"Error processing Hot Pepper API response: {e}")
            return []

    def convert_hotpepper_to_coupon(self, shop: Dict, user_lat: float, user_lng: float) -> Optional[Dict]:
        """Convert Hot Pepper shop data to our Coupon format"""
        try:
            # Extract basic information
            shop_id = shop.get('id', '')
            shop_name = shop.get('name', '店舗名不明')
            
            # Extract location
            lat = float(shop.get('lat', user_lat))
            lng = float(shop.get('lng', user_lng))
            
            # Calculate distance
            distance = self.calculate_distance(user_lat, user_lng, lat, lng)
            
            # Extract coupon information
            coupon_urls = shop.get('coupon_urls', {})
            mobile_coupon = coupon_urls.get('sp', coupon_urls.get('pc', ''))
            
            # Generate coupon details
            # Hot Pepper doesn't provide specific discount rates, so we'll use shop info to estimate
            discount_rate = 20  # Default discount rate
            
            # Try to extract discount from shop description or name
            if 'discount' in shop.get('catch', '').lower():
                discount_rate = 30
            elif 'special' in shop.get('catch', '').lower() or 'お得' in shop.get('catch', ''):
                discount_rate = 25
            
            # Create coupon title
            genre_name = shop.get('genre', {}).get('name', '')
            title = f"{shop_name} - {genre_name}クーポン"
            if len(title) > 50:
                title = f"{shop_name}クーポン"
            
            # Extract description
            description = shop.get('catch', shop.get('access', ''))
            if not description:
                description = f"{shop_name}でご利用いただけるクーポンです"
            
            # Set expiration (Hot Pepper coupons typically valid for 30 days)
            expires_at = datetime.now() + timedelta(days=30)
            
            # Extract address
            address = shop.get('address', '')
            
            # Extract photo URL
            photo_url = ''
            if 'photo' in shop and 'mobile' in shop['photo']:
                photo_url = shop['photo']['mobile'].get('l', shop['photo']['mobile'].get('m', ''))
            
            coupon_data = {
                'id': f"hotpepper_{shop_id}",
                'title': title,
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
                'source': 'hotpepper',
                'external_id': shop_id,
                'external_url': mobile_coupon or shop.get('urls', {}).get('pc', ''),
                'image_url': photo_url,
                'address': address,
                'distance_meters': distance,
                'genre': genre_name,
                'budget': shop.get('budget', {}).get('name', ''),
                'access': shop.get('access', ''),
                'open_time': shop.get('open', ''),
                'close_time': shop.get('close', ''),
            }
            
            logger.info(f"Converted Hot Pepper coupon: {coupon_data['id']} - {coupon_data['shop_name']}")
            return coupon_data
            
        except Exception as e:
            logger.error(f"Failed to convert Hot Pepper shop data: {e}")
            logger.error(f"Original shop data: {shop}")
            return None

    async def fetch_hotpepper_coupons_near_location(self, lat: float, lng: float, radius: int) -> List[Dict]:
        """Fetch Hot Pepper coupons near specified location"""
        coupons = []
        
        try:
            logger.info(f"Starting Hot Pepper coupon fetch for location: {lat}, {lng}")
            
            # Fetch shops with coupons
            shops = await self.fetch_hotpepper_shops(lat, lng, radius)
            
            if not shops:
                logger.warning("No Hot Pepper shops found")
                # If no real shops found, generate mock data based on user location
                mock_coupons = await self.generate_hotpepper_mock_coupons_near_user(lat, lng, radius)
                coupons.extend(mock_coupons)
                return coupons
            
            logger.info(f"Found {len(shops)} Hot Pepper shops")
            
            # Convert shops to coupons
            for shop in shops:
                try:
                    converted_coupon = self.convert_hotpepper_to_coupon(shop, lat, lng)
                    if converted_coupon:
                        coupons.append(converted_coupon)
                        logger.info(f"Added Hot Pepper coupon: {converted_coupon['id']} - {converted_coupon['shop_name']}")
                        
                        # Limit to prevent too many external coupons
                        if len(coupons) >= 20:
                            break
                            
                except Exception as e:
                    logger.error(f"Failed to process Hot Pepper shop: {e}")
                    continue
            
            logger.info(f"Successfully fetched {len(coupons)} Hot Pepper coupons")
                            
        except Exception as e:
            logger.error(f"Failed to fetch Hot Pepper coupons: {e}")
        
        return coupons

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

# Mock Hot Pepper data for testing
MOCK_HOTPEPPER_COUPONS = [
    {
        'id': 'hotpepper_tokyo_1',
        'title': '東京駅前居酒屋 - 和食クーポン',
        'description': '新鮮な海鮮と地酒をお楽しみください',
        'store_name': '海鮮居酒屋 魚心',
        'shop_name': '海鮮居酒屋 魚心',
        'current_discount': 25,
        'discount_rate_initial': 25,
        'location': {'lat': 35.6815, 'lng': 139.7678},
        'start_time': datetime.now(),
        'end_time': datetime.now() + timedelta(days=30),
        'expires_at': (datetime.now() + timedelta(days=30)).isoformat(),
        'active_status': 'active',
        'source': 'hotpepper',
        'external_id': 'hp_mock_1',
        'external_url': 'https://www.hotpepper.jp/strJ001234567/',
        'distance_meters': 0,
        'genre': '和食',
        'budget': '3000～4000円',
        'access': '東京駅徒歩3分'
    },
    {
        'id': 'hotpepper_shibuya_1',
        'title': '渋谷イタリアン - 洋食クーポン',
        'description': '本格イタリアンをカジュアルに',
        'store_name': 'トラットリア・ベラヴィスタ',
        'shop_name': 'トラットリア・ベラヴィスタ',
        'current_discount': 30,
        'discount_rate_initial': 30,
        'location': {'lat': 35.6595, 'lng': 139.7003},
        'start_time': datetime.now(),
        'end_time': datetime.now() + timedelta(days=30),
        'expires_at': (datetime.now() + timedelta(days=30)).isoformat(),
        'active_status': 'active',
        'source': 'hotpepper',
        'external_id': 'hp_mock_2',
        'external_url': 'https://www.hotpepper.jp/strJ001234568/',
        'distance_meters': 0,
        'genre': 'イタリアン・フレンチ',
        'budget': '2000～3000円',
        'access': '渋谷駅徒歩5分'
    },
    {
        'id': 'hotpepper_shinjuku_1',
        'title': '新宿焼肉 - 焼肉・韓国料理クーポン',
        'description': 'A5ランク和牛をリーズナブルに',
        'store_name': '炭火焼肉 牛角 新宿店',
        'shop_name': '炭火焼肉 牛角 新宿店',
        'current_discount': 20,
        'discount_rate_initial': 20,
        'location': {'lat': 35.6893, 'lng': 139.7003},
        'start_time': datetime.now(),
        'end_time': datetime.now() + timedelta(days=30),
        'expires_at': (datetime.now() + timedelta(days=30)).isoformat(),
        'active_status': 'active',
        'source': 'hotpepper',
        'external_id': 'hp_mock_3',
        'external_url': 'https://www.hotpepper.jp/strJ001234569/',
        'distance_meters': 0,
        'genre': '焼肉・韓国料理',
        'budget': '3000～4000円',
        'access': '新宿駅東口徒歩2分'
    }
]

async def get_mock_external_coupons(lat: float, lng: float, radius: int = 5000) -> List[Dict]:
    """Get mock external coupons for testing - generated dynamically near user location"""
    service = ExternalCouponService()
    result_coupons = []
    
    # Generate Kumapon mock coupons near user location
    kumapon_mock_coupons = await generate_kumapon_mock_coupons_near_user(lat, lng, radius)
    result_coupons.extend(kumapon_mock_coupons)
    
    # Generate Hot Pepper mock coupons near user location
    hotpepper_mock_coupons = await service.generate_hotpepper_mock_coupons_near_user(lat, lng, radius)
    result_coupons.extend(hotpepper_mock_coupons)
    
    return result_coupons

async def generate_kumapon_mock_coupons_near_user(user_lat: float, user_lng: float, radius: int) -> List[Dict]:
    """Generate Kumapon mock coupons near user's location"""
    import random
    import math
    import logging
    
    logger = logging.getLogger(__name__)
    
    mock_coupons = []
    
    # Generate 3-5 mock Kumapon coupons around user location
    num_coupons = random.randint(3, 5)
    
    # Service types for Kumapon
    service_types = [
        {"category": "グルメ", "names": ["レストラン食事券", "カフェ利用券", "居酒屋クーポン"], "emoji": "🍽️"},
        {"category": "美容・エステ", "names": ["エステ体験", "美容室カット", "ネイルサロン"], "emoji": "💅"},
        {"category": "健康・マッサージ", "names": ["マッサージ60分", "整体治療", "リラクゼーション"], "emoji": "💆"},
        {"category": "レジャー", "names": ["映画館チケット", "温泉入浴券", "カラオケ利用券"], "emoji": "🎬"},
        {"category": "ショッピング", "names": ["ファッション割引券", "雑貨店クーポン", "家電量販店割引"], "emoji": "🛍️"}
    ]
    
    for i in range(num_coupons):
        # Random position within radius around user - concentrated near user location
        angle = random.uniform(0, 2 * 3.14159)
        
        # Generate distances with preference for closer locations
        rand = random.random()
        if rand < 0.6:  # 60% within 300m (歩いて3-4分)
            distance_m = random.uniform(50, 300)
        elif rand < 0.85:  # 25% within 300m-700m (歩いて4-8分)
            distance_m = random.uniform(300, 700)
        else:  # 15% within 700m-1200m (歩いて8-15分)
            distance_m = random.uniform(700, min(radius, 1200))
        
        # Convert to lat/lng offset using proper geographic calculation
        # Earth's radius in meters
        R = 6371000
        
        # Convert distance to radians
        distance_rad = distance_m / R
        
        # Calculate new coordinates
        lat1 = math.radians(user_lat)
        lng1 = math.radians(user_lng)
        
        lat2 = math.asin(math.sin(lat1) * math.cos(distance_rad) + 
                       math.cos(lat1) * math.sin(distance_rad) * math.cos(angle))
        lng2 = lng1 + math.atan2(math.sin(angle) * math.sin(distance_rad) * math.cos(lat1),
                               math.cos(distance_rad) - math.sin(lat1) * math.sin(lat2))
        
        coupon_lat = math.degrees(lat2)
        coupon_lng = math.degrees(lng2)
        
        # Random service type
        service_type = random.choice(service_types)
        service_name = random.choice(service_type["names"])
        
        # Random discount
        discount_rates = [30, 40, 50, 60, 70]
        discount = random.choice(discount_rates)
        
        # Random original price
        original_prices = [3000, 5000, 8000, 10000, 15000]
        original_price = random.choice(original_prices)
        sale_price = int(original_price * (100 - discount) / 100)
        walk_minutes = max(1, int(distance_m / 80))  # 80m/分で計算
        
        mock_coupon = {
            'id': f'kumapon_mock_{i+1}_{user_lat:.4f}_{user_lng:.4f}',
            'title': f'{service_name} {discount}% OFF',
            'description': f'{service_type["emoji"]} {service_type["category"]}のお得なクーポン（徒歩{walk_minutes}分）',
            'store_name': f'{service_type["category"]}店',
            'shop_name': f'{service_type["category"]}店',
            'current_discount': discount,
            'discount_rate_initial': discount,
            'location': {'lat': coupon_lat, 'lng': coupon_lng},
            'start_time': datetime.now(),
            'end_time': datetime.now() + timedelta(hours=random.randint(4, 12)),
            'expires_at': (datetime.now() + timedelta(hours=random.randint(4, 12))).isoformat(),
            'active_status': 'active',
            'source': 'kumapon',
            'external_id': f'kp_mock_{i+1}',
            'external_url': f'https://kumapon.jp/deals/2025062{i+1}kpd25600{i+1}',
            'original_price': original_price,
            'sale_price': sale_price,
            'distance_meters': distance_m
        }
        
        mock_coupons.append(mock_coupon)
        logger.info(f"Generated mock Kumapon coupon: {mock_coupon['id']} - {mock_coupon['shop_name']}")
    
    return mock_coupons
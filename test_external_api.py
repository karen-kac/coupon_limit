import asyncio
import logging
from external_coupons import ExternalCouponService

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_external_apis():
    """外部APIの動作をテストする"""
    service = ExternalCouponService()
    
    # テスト用の座標（東京駅周辺）
    test_lat = 35.6812
    test_lng = 139.7671
    
    print("=== 外部APIテスト開始 ===")
    
    # Yahoo!マップAPIテスト
    print("\n1. Yahoo!マップAPIテスト...")
    try:
        yahoo_coupons = await service.fetch_yahoo_coupons_near_location(test_lat, test_lng, 3000)
        print(f"Yahoo!マップクーポン取得数: {len(yahoo_coupons)}")
        if yahoo_coupons:
            for i, coupon in enumerate(yahoo_coupons[:3]):
                print(f"  {i+1}. {coupon.get('shop_name', 'N/A')} - {coupon.get('title', 'N/A')}")
    except Exception as e:
        print(f"Yahoo!マップAPIエラー: {e}")
    
    # KumaponAPIテスト
    print("\n2. KumaponAPIテスト...")
    try:
        kumapon_coupons = await service.fetch_kumapon_coupons_near_location(test_lat, test_lng, 50000)
        print(f"Kumaponクーポン取得数: {len(kumapon_coupons)}")
        if kumapon_coupons:
            for i, coupon in enumerate(kumapon_coupons[:3]):
                print(f"  {i+1}. {coupon.get('shop_name', 'N/A')} - {coupon.get('title', 'N/A')}")
    except Exception as e:
        print(f"KumaponAPIエラー: {e}")
    
    # ホットペッパーAPIテスト
    print("\n3. ホットペッパーAPIテスト...")
    try:
        hotpepper_coupons = await service.fetch_hotpepper_coupons_near_location(test_lat, test_lng, 3000)
        print(f"ホットペッパークーポン取得数: {len(hotpepper_coupons)}")
        if hotpepper_coupons:
            for i, coupon in enumerate(hotpepper_coupons[:3]):
                print(f"  {i+1}. {coupon.get('shop_name', 'N/A')} - {coupon.get('title', 'N/A')}")
    except Exception as e:
        print(f"ホットペッパーAPIエラー: {e}")
    
    print("\n=== テスト完了 ===")

if __name__ == "__main__":
    asyncio.run(test_external_apis()) 
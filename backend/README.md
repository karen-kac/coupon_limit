# クーポン管理システム バックエンド

## 概要
このバックエンドサービスは、位置情報ベースのクーポン管理システムのAPIを提供します。FastAPIを使用して構築されており、SQLAlchemyでデータベース操作を行います。

## 主な機能
- クーポンの作成、取得、更新、削除
- 位置情報に基づくクーポンの検索
- ユーザーへのクーポン配布
- クーポンの使用状況の追跡
- 管理者向け統計情報の提供

## 技術スタック
- Python 3.8+
- FastAPI
- SQLAlchemy
- PostgreSQL

## セットアップ方法

1. 必要なパッケージのインストール:
```bash
pip install -r requirements.txt
```

2. 環境変数の設定:
```bash
cp .env.example .env
# .envファイルを編集して必要な設定を行う
```

3. データベースのセットアップ:
```bash
alembic upgrade head
```

4. サーバーの起動:
```bash
uvicorn main:app --reload
```

## API エンドポイント

### 一般ユーザー向け
- `GET /api/coupons` - 近くのクーポンを取得
- `POST /api/coupons/get` - クーポンを取得
- `GET /api/user/{user_id}/coupons` - ユーザーのクーポン一覧
- `POST /api/user/{user_id}/coupons/{coupon_id}/use` - クーポンを使用

### 管理者向け
- `POST /api/admin/coupons` - クーポンの作成
- `GET /api/admin/coupons` - 全クーポンの取得
- `GET /api/admin/coupons/{coupon_id}` - クーポンの詳細情報
- `PUT /api/admin/coupons/{coupon_id}` - クーポンの更新
- `DELETE /api/admin/coupons/{coupon_id}` - クーポンの削除
- `GET /api/admin/stats` - 統計情報の取得

## 開発ガイドライン
- コードはPEP 8に従って記述
- 新機能の追加時はテストを作成
- コミットメッセージは明確に記述

## デプロイメント
本番環境へのデプロイは、Dockerを使用して行います：

```bash
docker build -t coupon-backend .
docker run -p 8000:8000 coupon-backend
``` 
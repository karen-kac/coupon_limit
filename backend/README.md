# クーポン管理システム バックエンド

## 概要
このバックエンドサービスは、位置情報ベースのクーポン管理システムのAPIを提供します。FastAPIを使用して構築されており、SQLAlchemyでデータベース操作を行います。本番環境ではSupabase（PostgreSQL）、開発環境ではSQLiteを使用します。

## 主な機能
- **ユーザー認証**: JWT Token ベースの認証システム
- **管理者認証**: ロールベースのアクセス制御（店舗オーナー・スーパー管理者）
- **クーポン管理**: CRUD操作と位置情報ベースの検索
- **店舗管理**: 店舗の作成・管理機能
- **位置情報サービス**: Haversine公式による距離計算
- **統計情報**: ダッシュボード用の集計データ提供
- **データベース切り替え**: 環境に応じたDB接続の自動切り替え

## 技術スタック
- **Python**: 3.8+
- **Webフレームワーク**: FastAPI
- **ORM**: SQLAlchemy
- **データベース**: 
  - 本番環境: Supabase (PostgreSQL)
  - 開発環境: SQLite
- **認証**: JWT (python-jose)
- **バリデーション**: Pydantic
- **CORS**: FastAPI CORS Middleware

## プロジェクト構造

```
backend/
├── server.py              # メインFastAPIアプリケーション
├── models.py              # SQLAlchemyモデル定義
├── repositories.py        # データアクセス層
├── auth.py                # JWT認証ロジック
├── supabase_client.py     # データベース接続設定
├── api/                   # APIルーティング
│   ├── admin_routes.py    # 管理者向けエンドポイント
│   ├── auth_routes.py     # 認証エンドポイント
│   ├── coupon_routes.py   # クーポン関連エンドポイント
│   ├── user_routes.py     # ユーザー関連エンドポイント
│   └── main.py            # APIルートの統合
├── requirements.txt       # Python依存関係
└── test/                  # テストファイル
    ├── backend_test.py
    └── test_server.py
```

## セットアップ方法

### 1. 必要なパッケージのインストール
```bash
cd backend
pip install -r requirements.txt
```

### 2. 環境変数の設定
```bash
# .envファイルを作成
cp .env.example .env
```

`.env`ファイルの内容例:
```bash
# 開発環境用
DATABASE_URL=sqlite:///./coupon_app.db
SQL_DEBUG=true
CREATE_SAMPLE_DATA=true

# 本番環境用（Supabase）
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_DATABASE_URL=postgresql://user:pass@host:port/database

# JWT設定
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# その他
REGISTRATION_CODE=your-super-admin-registration-code
```

### 3. データベースの初期化
```bash
# 開発環境（SQLite）: 自動で作成されます
# 本番環境（Supabase）: supabase_schema.sqlを実行
```

### 4. サーバーの起動
```bash
# 開発モード
python server.py

# 本番モード  
uvicorn server:app --host 0.0.0.0 --port 8000
```

サーバーは `http://localhost:8000` で起動します。

## API エンドポイント

### 認証関連 (`/api/auth`)
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ユーザーログイン  
- `GET /api/auth/me` - 現在のユーザー情報取得
- `GET /api/auth/verify` - トークン検証

### ユーザー向け (`/api`)
- `GET /api/coupons` - 周辺クーポン検索
  - パラメータ: `lat`, `lng`, `radius`
- `POST /api/coupons/get` - クーポン取得
- `GET /api/user/coupons` - ユーザーのクーポン一覧
- `POST /api/user/coupons/{user_coupon_id}/use` - クーポン使用
- `GET /api/stores/public` - 公開店舗一覧

### 管理者向け (`/api/admin`)

#### 認証
- `POST /api/admin/auth/login` - 管理者ログイン
- `POST /api/admin/auth/register` - 管理者登録

#### 店舗管理
- `GET /api/admin/stores` - 店舗一覧取得
- `POST /api/admin/stores` - 店舗作成
- `GET /api/admin/stores/{store_id}` - 店舗詳細取得
- `PUT /api/admin/stores/{store_id}` - 店舗更新
- `DELETE /api/admin/stores/{store_id}` - 店舗削除

#### クーポン管理
- `GET /api/admin/coupons` - 全クーポン取得
- `POST /api/admin/coupons` - クーポン作成
- `GET /api/admin/coupons/{coupon_id}` - クーポン詳細取得
- `PUT /api/admin/coupons/{coupon_id}` - クーポン更新
- `DELETE /api/admin/coupons/{coupon_id}` - クーポン削除

#### 統計情報
- `GET /api/admin/stats` - ダッシュボード統計情報
- `GET /api/admin/coupons/{coupon_id}/users` - クーポン取得ユーザー一覧

### システム
- `GET /api/health` - ヘルスチェック

## データベースモデル

### User（ユーザー）
```python
- id: UUID (主キー)
- name: String (ユーザー名)
- email: String (メールアドレス・ユニーク)
- password_hash: String (ハッシュ化パスワード)
- created_at: DateTime
```

### Store（店舗）
```python
- id: UUID (主キー)
- name: String (店舗名)
- description: String (説明)
- latitude: Float (緯度)
- longitude: Float (経度)
- address: String (住所)
- logo_url: String (ロゴURL)
- owner_email: String (オーナーメール)
- created_at: DateTime
```

### Coupon（クーポン）
```python
- id: UUID (主キー)
- store_id: UUID (店舗ID・外部キー)
- title: String (タイトル)
- description: String (説明)
- discount_rate_initial: Integer (初期割引率)
- discount_rate_schedule: JSON (割引率スケジュール)
- start_time: DateTime (開始時間)
- end_time: DateTime (終了時間)
- created_at: DateTime
```

### UserCoupon（ユーザー取得クーポン）
```python
- id: UUID (主キー)
- user_id: UUID (ユーザーID・外部キー)
- coupon_id: UUID (クーポンID・外部キー)
- store_name: String (店舗名・非正規化)
- title: String (クーポンタイトル・非正規化)
- discount: Integer (取得時の割引率)
- obtained_at: DateTime (取得日時)
- is_used: Boolean (使用フラグ)
- used_at: DateTime (使用日時)
```

### Admin（管理者）
```python
- id: UUID (主キー)
- email: String (メールアドレス・ユニーク)
- password_hash: String (ハッシュ化パスワード)
- role: String (権限: store_owner, super_admin)
- linked_store_id: UUID (関連店舗ID・オプション)
- created_at: DateTime
```

## 認証システム

### JWT Token
- **アルゴリズム**: HS256
- **有効期限**: 30分（設定可能）
- **Payload**: ユーザーID/管理者ID、ユーザータイプ

### ロールベースアクセス制御
- **store_owner**: 自分の店舗のクーポンのみ管理可能
- **super_admin**: 全店舗・全クーポンの管理可能

## 位置情報処理

### 距離計算
Haversine公式を使用して2点間の距離を計算:
```python
def calculate_distance(lat1, lng1, lat2, lng2) -> float:
    # 地球の半径6371kmで計算
    # 返り値はメートル単位
```

### クーポン取得条件
- ユーザーの現在位置から店舗まで**20m以内**
- クーポンの有効期限内

## 開発ガイドライン

### コーディング規約
- **PEP 8**に従ったコーディング
- **Type Hints**の積極的な使用
- **Docstring**の記述

### テスト
```bash
# 全テスト実行
python -m pytest test/

# 特定のテストファイル
python -m pytest test/backend_test.py

# カバレッジ付きテスト
python -m pytest --cov=. test/
```

### エラーハンドリング
- **HTTPException**を使用した適切なステータスコード返却
- **バリデーションエラー**の詳細メッセージ
- **ログ出力**による問題の追跡

## デプロイメント

### Docker使用
```bash
# Dockerイメージ作成
docker build -t coupon-backend .

# コンテナ実行
docker run -p 8000:8000 --env-file .env coupon-backend
```

### Supabase Functions
```bash
# Supabase CLIを使用
supabase functions deploy coupon-api
```

### 本番環境の注意点
- **CORS設定**の適切な制限
- **環境変数**の安全な管理
- **データベース接続プール**の最適化
- **ログレベル**の調整

## データベース操作

### マイグレーション
```bash
# Supabase環境
# supabase_schema.sqlを実行

# SQLite環境
# 自動でテーブル作成
```

### サンプルデータ
環境変数 `CREATE_SAMPLE_DATA=true` で自動作成:
- 3つのサンプル店舗
- 各店舗に対応する管理者アカウント
- スーパー管理者アカウント

### データリセット
```bash
# SQLite
rm coupon_app.db

# Supabase
# ダッシュボードからテーブル初期化
```

## API仕様書

サーバー起動後、以下のURLでSwagger UIを確認できます:
- **開発環境**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## トラブルシューティング

### よくある問題
1. **データベース接続エラー**: 環境変数の確認
2. **JWT認証エラー**: SECRET_KEYの設定確認
3. **CORS エラー**: フロントエンドのURLが許可されているか確認
4. **位置情報エラー**: 距離計算の精度確認

### ログ出力
```python
# SQL実行ログ
SQL_DEBUG=true

# アプリケーションログ
import logging
logging.basicConfig(level=logging.INFO)
```

### パフォーマンス最適化
- **接続プール**の設定
- **クエリの最適化**
- **インデックス**の適切な設定
- **レスポンスキャッシュ**の実装

## 貢献

バグ報告や機能追加の提案を歓迎します。プルリクエストの際は、以下を確認してください:
- テストの追加
- ドキュメントの更新
- コーディング規約の遵守 
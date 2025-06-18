# クーポン配信アプリ

位置情報を使用したクーポン配信システム。ユーザーが店舗の近くを通ると、時間制限付きクーポンを取得できるWebアプリです。

## 機能

### ユーザー機能
- 📱 ユーザー登録・ログイン
- 📍 位置情報連動のマップ表示
- 🎫 20m以内でのクーポン取得
- ⏰ 時間制限による割引率の段階的アップ
- 💥 期限切れクーポンの爆発演出
- 📱 レスポンシブデザイン（モバイル対応）
- 👤 マイページでクーポン管理

### 管理者機能
- 🔐 管理者認証システム（店舗オーナー・スーパー管理者）
- 🏪 店舗管理（作成・編集・削除）
- 🎫 クーポン管理（作成・編集・削除・統計）
- 📊 ダッシュボード（統計情報表示）
- 👥 ユーザー管理

## 技術スタック

- **フロントエンド**: React 18 + TypeScript
- **バックエンド**: Python FastAPI + SQLAlchemy
- **データベース**: PostgreSQL (Supabase) / SQLite (開発環境)
- **認証**: JWT Token ベース
- **マップ**: Google Maps API
- **スタイリング**: CSS
- **デプロイメント**: Vercel (フロントエンド) + Supabase (バックエンド・DB)

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd coupon_limit
```

### 2. バックエンドの起動

```bash
# Pythonの仮想環境を作成（推奨）
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係をインストール
cd backend
pip install -r requirements.txt

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してSupabaseの設定を行う

# サーバーを起動
python server.py
```

バックエンドは `http://localhost:8000` で起動します。

### 3. フロントエンドの起動

新しいターミナルで：

```bash
cd frontend
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してAPIキーを設定

npm start
```

フロントエンドは `http://localhost:3000` で起動します。

### 4. 管理者画面の利用

ブラウザで `admin/index.html` を直接開いてアクセス：

デモ用管理者アカウント:
- coffee@example.com / store1123
- restaurant@example.com / store2123  
- bookstore@example.com / store3123

### 5. 必要なAPIキーの設定

#### Google Maps API
1. [Google Cloud Console](https://console.cloud.google.com/) でAPIキーを取得
2. `frontend/.env`ファイルに追加：
   ```
   REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

#### Supabase設定（本番環境）
1. [Supabase](https://supabase.com/) でプロジェクトを作成
2. `backend/.env`ファイルに追加：
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   SUPABASE_DATABASE_URL=your_database_url
   ```

## 使用方法

### ユーザー側
1. ブラウザで `http://localhost:3000` にアクセス
2. ユーザー登録またはログイン
3. 位置情報の許可を求められたら「許可」をクリック
4. マップ上のクーポンアイコンをタップしてクーポン詳細を確認
5. 20m以内に近づくとクーポンが取得可能になります
6. 「マイページ」タブで取得したクーポンを確認・使用できます

### 管理者側
1. ブラウザで `http://localhost:3001` にアクセス
2. 管理者アカウントでログイン
3. ダッシュボードで統計情報を確認
4. クーポン管理タブで新規クーポンの作成・既存クーポンの管理
5. 店舗管理タブで店舗情報の管理（スーパー管理者のみ）

## API エンドポイント

### 認証
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ユーザーログイン
- `GET /api/auth/me` - 現在のユーザー情報取得
- `GET /api/auth/verify` - トークン検証

### ユーザー向け
- `GET /api/coupons?lat={lat}&lng={lng}&radius={radius}` - 周辺クーポン取得
- `POST /api/coupons/get` - クーポン取得
- `GET /api/user/coupons` - ユーザーのクーポン一覧
- `POST /api/user/coupons/{user_coupon_id}/use` - クーポン使用
- `GET /api/stores/public` - 公開店舗一覧

### 管理者向け
- `POST /api/admin/auth/login` - 管理者ログイン
- `POST /api/admin/auth/register` - 管理者登録
- `GET /api/admin/stores` - 店舗管理
- `POST /api/admin/stores` - 店舗作成
- `GET /api/admin/coupons` - 全クーポン取得
- `POST /api/admin/coupons` - クーポン作成
- `PUT /api/admin/coupons/{id}` - クーポン更新
- `DELETE /api/admin/coupons/{id}` - クーポン削除
- `GET /api/admin/stats` - 統計情報取得

### システム
- `GET /api/health` - ヘルスチェック

## 開発者向け情報

### プロジェクト構造

```
coupon_limit/
├── frontend/              # React アプリ
│   ├── src/
│   │   ├── components/        # Reactコンポーネント
│   │   ├── admin/             # 管理者用コンポーネント
│   │   ├── context/           # Context API (認証など)
│   │   ├── services/          # API呼び出し
│   │   └── types.ts           # TypeScript型定義
├── backend/               # Python FastAPI
│   ├── api/                   # APIルーティング
│   ├── server.py              # メインサーバーファイル
│   ├── models.py              # データベースモデル
│   ├── repositories.py        # データアクセス層
│   ├── auth.py                # 認証ロジック
│   ├── supabase_client.py     # Supabase接続設定
│   └── requirements.txt       # Python依存関係
├── admin/                 # 管理者画面（静的HTML）
│   ├── index.html
│   ├── admin.css
│   └── admin.js
├── doc/                   # ドキュメント
└── test/                  # テストファイル
```

### データベース構造

#### PostgreSQL/Supabaseテーブル
- **users**: ユーザー情報
- **stores**: 店舗情報
- **coupons**: クーポン情報
- **user_coupons**: ユーザー取得クーポン
- **admins**: 管理者情報

#### 環境切り替え
- **開発環境**: SQLite (`backend/coupon_app.db`)
- **本番環境**: Supabase PostgreSQL

### 認証システム
- **JWT Token**ベースの認証
- **ユーザー**と**管理者**で分離された認証フロー
- **ロールベース**のアクセス制御（店舗オーナー・スーパー管理者）

### サンプルデータ

デモ用に東京駅周辺のサンプル店舗・クーポンが自動で生成されます：
- 東京駅コーヒーショップ
- 銀座レストラン
- 新宿書店

### デプロイメント

#### フロントエンド (Vercel)
```bash
cd frontend
npm run build
# Vercelにデプロイ
```

#### バックエンド (Supabase Functions または任意のサーバー)
```bash
cd backend
# Dockerイメージ作成
docker build -t coupon-backend .
```

### 開発時の注意点
- フロントエンドは `http://localhost:3000`
- バックエンドは `http://localhost:8000`
- 管理者画面は `admin/index.html` を直接開く
- 位置情報APIは HTTPS または localhost でのみ動作

### テスト
```bash
# バックエンドテスト
cd backend
python -m pytest test/

# フロントエンドテスト
cd frontend
npm test
```

## データのリセット

### 開発環境（SQLite）
`backend/coupon_app.db` ファイルを削除してサーバー再起動

### 本番環境（Supabase）
Supabaseのダッシュボードからテーブルを初期化

## トラブルシューティング

### よくある問題
1. **位置情報が取得できない**: HTTPS環境またはlocalhostで実行してください
2. **CORS エラー**: バックエンドのCORS設定を確認してください
3. **データベース接続エラー**: 環境変数の設定を確認してください
4. **認証エラー**: JWTトークンの有効期限を確認してください

### ログの確認
- バックエンド: コンソール出力
- フロントエンド: ブラウザの開発者ツール
- データベース: Supabaseダッシュボード

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告を歓迎します。
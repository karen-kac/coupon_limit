# API設定ガイド

Coupon Limitアプリケーションをデプロイするために必要なAPIキーの取得・設定手順を説明します。

## 📋 必要なAPIサービス一覧

| サービス | 用途 | 必須レベル | 費用 |
|---------|------|----------|------|
| **Supabase** | データベース・認証 | 🔴 必須 | 無料プランあり |
| **Google Maps API** | 地図表示・ジオコーディング | 🔴 必須 | 月$200無料枠 |
| **Vercel** | ホスティング・デプロイ | 🔴 必須 | 無料プランあり |
| **Cloudinary** | 画像アップロード | 🟡 オプション | 無料プランあり |

---

## 🗄️ 1. Supabase（データベース）

### 1.1 アカウント作成・プロジェクト設定

1. **Supabaseアカウント作成**
   - [https://supabase.com](https://supabase.com) にアクセス
   - GitHubアカウントでサインアップ

2. **新しいプロジェクト作成**
   - "New Project" をクリック
   - プロジェクト名: `coupon-limit`
   - データベースパスワードを設定（強力なパスワード推奨）
   - リージョン: `Northeast Asia (Tokyo)` を選択

3. **プロジェクト設定の確認**
   - プロジェクト作成後、ダッシュボードで以下を確認

### 1.2 必要な情報の取得

**Settings > API** から以下の情報を取得：

```bash
# Project URL
SUPABASE_URL=https://your-project-ref.supabase.co

# API Keys
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Database URL
SUPABASE_DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-ref.supabase.co:5432/postgres
```

### 1.3 データベーススキーマの設定

1. **SQL Editorでスキーマ実行**
   - Supabaseダッシュボード > SQL Editor
   - `/supabase_schema.sql` の内容をコピー&ペーストして実行

2. **Row Level Security (RLS) の有効化**
   - 各テーブルでRLSが有効になっていることを確認

---

## 🗺️ 2. Google Maps API

### 2.1 Google Cloud Console設定

1. **Google Cloud Consoleにアクセス**
   - [https://console.cloud.google.com](https://console.cloud.google.com)
   - Googleアカウントでログイン

2. **新しいプロジェクト作成**
   - プロジェクト名: `coupon-limit-maps`
   - 請求先アカウントを設定（無料枠利用でも必要）

### 2.2 必要なAPIの有効化

以下のAPIを有効化してください：

1. **Maps JavaScript API**
   - 地図表示用
   - 料金: $7.00 / 1,000リクエスト

2. **Geocoding API**
   - 住所→緯度経度変換用
   - 料金: $5.00 / 1,000リクエスト

3. **Places API (オプション)**
   - 場所検索用
   - 料金: 用途により異なる

### 2.3 APIキーの作成・制限設定

1. **APIキー作成**
   - 「認証情報」> 「認証情報を作成」> 「APIキー」
   - キー名: `coupon-limit-maps-key`

2. **APIキーの制限設定**
   ```
   アプリケーションの制限:
   - HTTPリファラー（Webサイト）
   
   許可するリファラー:
   - http://localhost:3000/*
   - https://your-app.vercel.app/*
   - file:///*  (ローカル開発用)
   
   API制限:
   - Maps JavaScript API
   - Geocoding API
   ```

3. **取得したAPIキー**
   ```bash
   REACT_APP_GOOGLE_MAPS_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

---

## 🚀 3. Vercel（デプロイ・ホスティング）

### 3.1 アカウント作成

1. **Vercelアカウント作成**
   - [https://vercel.com](https://vercel.com) にアクセス
   - GitHubアカウントでサインアップ

2. **GitHubリポジトリとの連携**
   - GitHubでプロジェクトリポジトリを作成
   - Vercelでリポジトリを選択してインポート

### 3.2 プロジェクト設定

1. **フレームワークプリセット**
   - Framework Preset: `Other`
   - Root Directory: `./`

2. **ビルド設定**
   ```bash
   Build Command: cd frontend && npm run build
   Output Directory: frontend/build
   Install Command: cd frontend && npm install
   ```

3. **環境変数設定**
   - Vercelダッシュボード > Settings > Environment Variables
   - 本ガイドで取得したすべての環境変数を設定

---

## 🖼️ 4. Cloudinary（画像管理）- オプション

### 4.1 アカウント作成

1. **Cloudinaryアカウント作成**
   - [https://cloudinary.com](https://cloudinary.com) にアクセス
   - 無料アカウントを作成

### 4.2 設定情報の取得

**Dashboard** から以下の情報を取得：

```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz123456
```

---

## 📝 環境変数ファイルの設定

### ルート `.env` ファイル（バックエンド用）

```bash
# Production Environment
NODE_ENV=production

# Backend API Configuration
NEXT_PUBLIC_API_URL=https://your-app.vercel.app/api
API_URL=https://your-app.vercel.app/api

# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# JWT Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-this-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Security Settings
ALLOWED_ORIGINS=https://your-app.vercel.app,http://localhost:3000
SUPER_ADMIN_REGISTRATION_CODE=SUPER_ADMIN_2024

# Application Settings
DEFAULT_COUPON_RADIUS_METERS=20
CREATE_SAMPLE_DATA=true
```

### フロントエンド `frontend/.env` ファイル

```bash
# API Configuration
REACT_APP_API_URL=https://your-app.vercel.app/api
REACT_APP_API_BASE_URL=https://your-app.vercel.app

# Google Maps API Key
REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key

# Application Settings
REACT_APP_NAME=Coupon Limit
REACT_APP_VERSION=1.0.0
REACT_APP_DEFAULT_LAT=35.6812
REACT_APP_DEFAULT_LNG=139.7671
REACT_APP_COUPON_RADIUS=20
REACT_APP_ENV=production
```

---

## 💰 費用概算

### 無料枠で運用可能な規模

| サービス | 無料枠 | 概算ユーザー数 |
|---------|--------|---------------|
| **Supabase** | 500MB DB, 50MB ストレージ | ~1,000ユーザー |
| **Google Maps** | $200/月クレジット | ~28,500 地図読み込み |
| **Vercel** | 100GB帯域幅 | ~10,000 ページビュー |
| **Cloudinary** | 25GB ストレージ | ~50,000 画像 |

### 有料プラン移行目安

- **月間1万ユーザー以上**: Supabase Pro ($25/月)
- **月間10万地図読み込み**: Google Maps従量課金
- **月間100GB帯域幅超過**: Vercel Pro ($20/月)

---

## ⚠️ セキュリティ注意事項

### 1. APIキーの保護

- **.env ファイルをGitにコミットしない**
- **本番環境では強力なJWT秘密鍵を使用**
- **定期的にAPIキーをローテーション**

### 2. Supabase RLS設定

- **Row Level Security を必ず有効化**
- **適切なポリシー設定を確認**

### 3. CORS設定

- **本番ドメインのみを許可**
- **ワイルドカード使用を避ける**

---

## 🔍 トラブルシューティング

### よくあるエラーと解決方法

1. **Google Maps が表示されない**
   - APIキーの制限設定を確認
   - リファラー設定が正しいか確認
   - 請求先アカウントが設定されているか確認

2. **Supabase接続エラー**
   - DATABASE_URL の形式を確認
   - プロジェクトのステータスを確認
   - RLS ポリシーを確認

3. **Vercelデプロイエラー**
   - 環境変数が全て設定されているか確認
   - ビルドコマンドが正しいか確認
   - ルートディレクトリ設定を確認

---

## 📞 サポート

### 公式ドキュメント

- [Supabase Docs](https://supabase.com/docs)
- [Google Maps API Docs](https://developers.google.com/maps)
- [Vercel Docs](https://vercel.com/docs)
- [Cloudinary Docs](https://cloudinary.com/documentation)

### コミュニティ

- [Supabase Discord](https://discord.supabase.com/)
- [Vercel Discord](https://discord.gg/vercel)

---

**🎯 このガイドに従って設定すれば、Coupon Limitアプリケーションが本番環境で動作します！**
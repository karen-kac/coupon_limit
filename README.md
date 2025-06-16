# クーポン配信アプリ

位置情報を使用したクーポン配信システム。ユーザーが店舗の近くを通ると、時間制限付きクーポンを取得できるWebアプリです。

## 機能

- 📍 位置情報連動のマップ表示
- 🎫 20m以内でのクーポン取得
- ⏰ 時間制限による割引率の段階的アップ
- 💥 期限切れクーポンの爆発演出
- 📱 レスポンシブデザイン（モバイル対応）

## 技術スタック

- **フロントエンド**: React + TypeScript
- **バックエンド**: Python FastAPI + SQLAlchemy
- **データベース**: SQLite
- **マップ**: Google Maps API
- **スタイリング**: CSS

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

# サーバーを起動
python main.py
```

バックエンドは `http://localhost:8000` で起動します。

### 3. フロントエンドの起動

新しいターミナルで：

```bash
cd frontend
npm install
npm start
```

フロントエンドは `http://localhost:3000` で起動します。

### 4. Google Maps APIキーの設定

1. [Google Cloud Console](https://console.cloud.google.com/) でAPIキーを取得
2. `frontend`ディレクトリに`.env`ファイルを作成し、以下の内容を追加：
   ```
   REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
3. アプリケーションを再起動して変更を反映

## 使用方法

1. ブラウザで `http://localhost:3000` にアクセス
2. 位置情報の許可を求められたら「許可」をクリック
3. マップ上のクーポンアイコンをタップしてクーポン詳細を確認
4. 20m以内に近づくとクーポンが取得可能になります
5. 「マイページ」タブで取得したクーポンを確認・使用できます

## API エンドポイント

- `GET /api/coupons?lat={lat}&lng={lng}&radius={radius}` - 周辺クーポン取得
- `POST /api/coupons/get` - クーポン取得
- `GET /api/user/{user_id}/coupons` - ユーザーのクーポン一覧
- `POST /api/user/{user_id}/coupons/{coupon_id}/use` - クーポン使用
- `GET /api/health` - ヘルスチェック

## 開発者向け情報

### プロジェクト構造

```
coupon_limit/
├── frontend/          # React アプリ
│   ├── src/
│   │   ├── components/    # Reactコンポーネント
│   │   ├── services/      # API呼び出し
│   │   └── types.ts       # TypeScript型定義
├── backend/           # Python FastAPI
│   ├── main.py           # メインサーバーファイル
│   └── requirements.txt  # Python依存関係
└── RDD.md            # 要件定義書
```

### サンプルデータ

デモ用に東京駅周辺のサンプルクーポンが自動で生成されます：
- コーヒーショップ (15% OFF)
- レストラン (20% OFF) 
- 書店 (10% OFF)

## 管理者画面

店舗管理者用の管理画面が用意されています。

### アクセス方法

1. バックエンドサーバーが起動していることを確認
2. ブラウザで `admin/index.html` を直接開く（例：`file:///path/to/coupon_limit/admin/index.html`）

### 管理機能

#### ダッシュボード
- 総クーポン数、アクティブ数、期限切れ数の表示
- 総取得数、使用数、使用率の表示

#### クーポン管理
- 全クーポンの一覧表示
- クーポンの詳細情報と統計の確認
- クーポンの編集・削除
- 取得ユーザーの一覧

#### 新規クーポン作成
- 店舗名、タイトル、割引率の設定
- 配信位置（緯度・経度）の指定
- 有効期限の設定
- 対象商品・条件の入力

### 管理者API エンドポイント

- `POST /api/admin/coupons` - クーポン作成
- `GET /api/admin/coupons` - 全クーポン取得
- `GET /api/admin/coupons/{id}` - クーポン詳細取得
- `PUT /api/admin/coupons/{id}` - クーポン更新
- `DELETE /api/admin/coupons/{id}` - クーポン削除
- `GET /api/admin/stats` - 統計情報取得

## データベース

### SQLiteデータベース

アプリケーションはSQLiteデータベースを使用してデータを永続化します。

- **データベースファイル**: `backend/coupon_app.db`
- **テーブル**: `coupons`, `user_coupons`
- **自動作成**: 初回起動時にテーブルが自動作成されます

### データベース構造

#### couponsテーブル
- `id`: クーポンID (主キー)
- `shop_name`: 店舗名
- `title`: クーポンタイトル
- `base_discount`: 基本割引率
- `current_discount`: 現在の割引率
- `lat`, `lng`: 位置情報
- `expires_at`: 有効期限
- `created_at`: 作成日時
- `is_active`: アクティブ状態
- `conditions`: 利用条件

#### user_couponsテーブル
- `id`: ユーザークーポンID (主キー)
- `coupon_id`: 関連クーポンID
- `user_id`: ユーザーID
- `shop_name`: 店舗名
- `title`: クーポンタイトル
- `discount`: 取得時の割引率
- `obtained_at`: 取得日時
- `is_used`: 使用状態
- `used_at`: 使用日時

### データのリセット

データベースをリセットする場合は `backend/coupon_app.db` ファイルを削除してください。次回起動時にサンプルデータが再作成されます。

### カスタマイズ

- **サンプルデータ**: `backend/main.py` の `startup_event` 関数
- **データベースモデル**: `backend/database.py`
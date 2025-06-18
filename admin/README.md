# クーポン管理システム 管理者画面

## 概要
この管理者画面は、クーポン管理システムの管理機能を提供します。Vanilla JavaScript + CSS で構築されており、管理者がクーポンの作成、管理、統計情報の確認を行うことができます。

## 主な機能

### 認証機能
- **管理者ログイン**: 店舗オーナー・スーパー管理者の認証
- **管理者登録**: 新規管理者アカウントの作成
- **ロールベースアクセス制御**: 権限に応じた機能制限

### 管理機能
#### ダッシュボード
- 総店舗数・総クーポン数・総ユーザー数の表示
- アクティブクーポン数・今日の取得数の表示
- リアルタイム統計情報の更新

#### クーポン管理
- 全クーポンの一覧表示（店舗オーナーは自店舗のみ）
- クーポンの詳細情報と統計の確認
- クーポンの編集・削除
- 新規クーポンの作成
- 取得ユーザーの一覧表示

#### 店舗管理（スーパー管理者のみ）
- 全店舗の一覧表示
- 店舗情報の編集・削除
- 新規店舗の作成

## 技術スタック
- **HTML5**: セマンティックマークアップ
- **CSS3**: フレックスボックス・グリッドレイアウト
- **Vanilla JavaScript**: ES6+ 機能の活用
- **Fetch API**: バックエンドとの通信
- **Local Storage**: 認証トークンの保存

## ファイル構成
```
admin/
├── index.html    # メインHTMLファイル
├── admin.css     # スタイルシート
├── admin.js      # JavaScript機能
└── README.md     # このファイル
```

## セットアップ方法

### 1. バックエンドサーバーの起動
```bash
cd backend
python server.py
```

### 2. 管理者画面のアクセス
ブラウザで `admin/index.html` を直接開く：
```
file:///path/to/coupon_limit/admin/index.html
```

または、ローカルサーバー経由でアクセス：
```bash
# Python simple server
cd coupon_limit
python -m http.server 8080
# アクセス: http://localhost:8080/admin/
```

## デモアカウント

### 店舗オーナーアカウント
```
Email: coffee@example.com
Password: store1123
権限: 東京駅コーヒーショップの管理

Email: restaurant@example.com  
Password: store2123
権限: 銀座レストランの管理

Email: bookstore@example.com
Password: store3123
権限: 新宿書店の管理
```

### スーパー管理者アカウント
```
Email: admin@couponlimit.com
Password: admin123
権限: 全店舗・全クーポンの管理
```

## 主要機能の詳細

### 認証システム
- **JWT Token**による認証
- **ロール確認**による画面制御
- **自動ログアウト**（トークン期限切れ時）

### ダッシュボード機能
```javascript
// 統計情報の取得と表示
async function loadDashboardStats() {
    // API: GET /api/admin/stats
    // 総店舗数、クーポン数、ユーザー数など
}
```

### クーポン管理機能
```javascript
// クーポン一覧の取得
async function loadCoupons() {
    // API: GET /api/admin/coupons
}

// クーポン作成
async function createCoupon(formData) {
    // API: POST /api/admin/coupons
}

// クーポン編集
async function updateCoupon(couponId, formData) {
    // API: PUT /api/admin/coupons/{id}
}
```

### 店舗管理機能（スーパー管理者のみ）
```javascript
// 店舗一覧の取得
async function loadStores() {
    // API: GET /api/admin/stores
}

// 店舗作成
async function createStore(formData) {
    // API: POST /api/admin/stores
}
```

## UI/UX 特徴

### レスポンシブデザイン
- **モバイル対応**: 768px以下でのレイアウト調整
- **タブレット対応**: 1024px以下での最適化
- **デスクトップ**: フルスクリーン対応

### カラーテーマ
```css
:root {
    --primary-color: #2c3e50;
    --secondary-color: #3498db;
    --success-color: #27ae60;
    --warning-color: #f39c12;
    --danger-color: #e74c3c;
    --background-color: #ecf0f1;
}
```

### アニメーション効果
- **ページ遷移**: smooth transition
- **ボタンホバー**: scale効果
- **モーダル**: fade in/out
- **データ読み込み**: ローディングスピナー

## API連携

### 認証API
```javascript
// ログイン
POST /api/admin/auth/login
{
    "email": "admin@example.com",
    "password": "password"
}

// レスポンス
{
    "access_token": "jwt_token",
    "token_type": "bearer",
    "admin": { /* 管理者情報 */ }
}
```

### 管理API
```javascript
// 統計情報取得
GET /api/admin/stats
// レスポンス: 店舗数、クーポン数、ユーザー数など

// クーポン一覧
GET /api/admin/coupons
// レスポンス: クーポン配列

// クーポン作成
POST /api/admin/coupons
{
    "title": "クーポンタイトル",
    "description": "説明",
    "discount_rate_initial": 15,
    "start_time": "2024-01-01T00:00:00Z",
    "end_time": "2024-12-31T23:59:59Z"
}
```

## エラーハンドリング

### 認証エラー
```javascript
// 401 Unauthorized の処理
function handleAuthError() {
    localStorage.removeItem('admin_token');
    showLoginScreen();
    showError('認証が無効です。再度ログインしてください。');
}
```

### ネットワークエラー
```javascript
// 接続エラーの処理
function handleNetworkError(error) {
    showError('サーバーとの接続に問題があります。');
    console.error('Network error:', error);
}
```

### バリデーションエラー
```javascript
// フォーム入力の検証
function validateCouponForm(formData) {
    if (!formData.title) {
        showError('タイトルは必須です。');
        return false;
    }
    // その他のバリデーション
    return true;
}
```

## セキュリティ対策

### トークン管理
- **Local Storage**に JWT Token を保存
- **有効期限チェック**による自動ログアウト
- **権限確認**による機能制限

### XSS対策
```javascript
// HTMLエスケープ関数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

### CSRF対策
- **SameSite Cookie**の使用
- **Origin検証**の実装

## パフォーマンス最適化

### 画像最適化
- **WebP形式**の使用
- **遅延読み込み**の実装
- **サイズ最適化**

### JavaScript最適化
```javascript
// デバウンス関数で検索の最適化
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
```

### CSS最適化
- **クリティカルCSS**のインライン化
- **未使用CSSの削除**
- **Minification**の実装

## ブラウザ対応

### 対応ブラウザ
- **Chrome**: 80+
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+

### 必要なAPI
- **Fetch API**: HTTP通信
- **Local Storage API**: データ保存
- **Promise API**: 非同期処理

## 開発・デバッグ

### デバッグ方法
```javascript
// デバッグログの有効化
const DEBUG = true;

function debugLog(message, data) {
    if (DEBUG) {
        console.log(`[Admin Debug] ${message}`, data);
    }
}
```

### 開発ツール
- **Chrome DevTools**: Network、Console タブの活用
- **ライブリロード**: VS Code Live Server の使用
- **コードフォーマット**: Prettier の適用

## 今後の改善予定

### 機能追加
- **ダークモード**: UI テーマの切り替え
- **エクスポート機能**: CSVでのデータ出力
- **通知機能**: リアルタイム通知
- **多言語対応**: 国際化サポート

### パフォーマンス向上
- **PWA対応**: Service Worker の実装
- **キャッシュ戦略**: データキャッシュの実装
- **コード分割**: 動的インポートの使用

## トラブルシューティング

### よくある問題

1. **ログインできない**
   - バックエンドサーバーの起動確認
   - アカウント情報の確認
   - ネットワーク接続の確認

2. **データが表示されない**
   - API接続の確認
   - 認証トークンの有効性確認
   - ブラウザの開発者ツールでエラー確認

3. **権限エラー**
   - ログインしている管理者の権限確認
   - 店舗オーナーは自店舗のみアクセス可能

4. **画面が崩れる**
   - ブラウザのキャッシュクリア
   - CSS ファイルの読み込み確認

### ログ確認
```javascript
// ブラウザのコンソールでエラー確認
console.error('Error details:', error);

// ネットワークタブでAPI通信確認
// 401: 認証エラー
// 403: 権限エラー  
// 500: サーバーエラー
```

## 貢献

バグ報告や機能追加の提案を歓迎します。改善提案の際は：
- **具体的な問題の説明**
- **再現手順の記載**
- **期待する動作の説明**
- **環境情報**（ブラウザ、OS等）

## ライセンス

MIT License 
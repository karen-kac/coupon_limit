# クーポン管理システム フロントエンド

## 概要
このフロントエンドアプリケーションは、位置情報ベースのクーポン管理システムのユーザーインターフェースを提供します。React 18 + TypeScriptで構築されており、モダンなUI/UXを実現しています。

## 主な機能

### ユーザー機能
- **認証システム**: ユーザー登録・ログイン・ログアウト
- **位置情報連動**: ユーザーの現在位置を取得してマップに表示
- **クーポン表示**: 近くのクーポンをマップ上に表示
- **クーポン取得**: 20m以内でクーポンを取得
- **リアルタイム更新**: 時間経過による割引率の自動更新
- **マイページ**: 取得したクーポンの一覧と使用
- **レスポンシブデザイン**: モバイル・デスクトップ対応

### 管理者機能（別途管理者画面）
- **管理者認証**: 店舗オーナー・スーパー管理者の認証
- **ダッシュボード**: 統計情報の表示
- **クーポン管理**: CRUD操作と統計
- **店舗管理**: 店舗情報の管理（スーパー管理者のみ）

## 技術スタック
- **React**: 18+
- **TypeScript**: 4.9+
- **React Router**: 6.30+ (ページルーティング)
- **Context API**: 認証状態管理
- **Google Maps API**: 地図表示と位置情報
- **CSS**: カスタムスタイリング
- **Web APIs**: Geolocation API

## プロジェクト構造
```
src/
├── components/           # 共通コンポーネント
│   ├── CouponPopup.tsx      # クーポン詳細ポップアップ
│   ├── ExplosionEffect.tsx  # 爆発エフェクト
│   ├── Login.tsx            # ログインフォーム
│   ├── Register.tsx         # 登録フォーム
│   ├── MapView.tsx          # Google Maps表示
│   └── MyPage.tsx           # マイページ
├── admin/                # 管理者用コンポーネント
│   ├── AdminApp.tsx         # 管理者アプリのルート
│   ├── components/          # 管理者専用コンポーネント
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminLayout.tsx
│   │   ├── AdminLogin.tsx
│   │   ├── CouponManagement.tsx
│   │   └── StoreManagement.tsx
│   └── context/
│       └── AdminAuthContext.tsx
├── context/              # コンテキスト
│   └── AuthContext.tsx      # ユーザー認証コンテキスト
├── services/             # API通信
│   └── api.ts               # バックエンドAPI呼び出し
├── types.ts              # TypeScript型定義
├── App.tsx               # メインアプリケーション
├── App.css               # アプリケーションスタイル
├── index.tsx             # エントリーポイント
└── index.css             # グローバルスタイル
```

## セットアップ方法

### 1. 必要なパッケージのインストール
```bash
cd frontend
npm install
```

### 2. 環境変数の設定
```bash
# .envファイルを作成
cp .env.example .env
```

`.env`ファイルの内容例:
```bash
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
REACT_APP_API_BASE_URL=http://localhost:8000
```

### 3. 開発サーバーの起動
```bash
npm start
```

アプリケーションは `http://localhost:3000` で起動します。

### 4. ビルド（本番環境用）
```bash
npm run build
```

## 主要コンポーネント

### App.tsx
- アプリケーションのルートコンポーネント
- React Routerによるページルーティング
- 認証状態の管理

### AuthContext.tsx
- ユーザー認証状態のグローバル管理
- JWT Tokenの保存・取得
- 自動ログイン機能

### MapView.tsx
- Google Maps APIを使用した地図表示
- ユーザーの現在位置の取得と表示
- 近くのクーポンのマーカー表示
- クーポンクリック時のポップアップ表示

### CouponPopup.tsx
- クーポンの詳細情報表示
- 距離に応じた取得可否の表示
- 時間経過による割引率の動的更新
- クーポン取得機能

### MyPage.tsx
- ユーザーが取得したクーポンの一覧
- クーポンの使用状態管理
- クーポン使用機能

### ExplosionEffect.tsx
- 期限切れクーポンの視覚的エフェクト
- CSS Animationを使用した爆発演出

### Login.tsx / Register.tsx
- ユーザー認証フォーム
- バリデーション機能
- エラーハンドリング

## 認証システム

### 認証フロー
1. ユーザーがログイン/登録
2. バックエンドからJWT Tokenを取得
3. LocalStorageにTokenを保存
4. APIリクエスト時にAuthorizationヘッダーに添付
5. トークン有効期限のチェック

### 認証コンテキスト
```typescript
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}
```

## API通信

### services/api.ts
バックエンドとの通信を担当:

```typescript
// 主要な関数
- login(email, password): Promise<AuthResponse>
- register(name, email, password): Promise<AuthResponse>
- getCoupons(lat, lng, radius): Promise<Coupon[]>
- getCoupon(couponId, userLocation): Promise<void>
- getUserCoupons(): Promise<UserCoupon[]>
- useCoupon(userCouponId): Promise<void>
```

### エラーハンドリング
- APIエラーの統一的な処理
- ユーザーフレンドリーなエラーメッセージ
- 認証エラー時の自動ログアウト

## 位置情報機能

### Geolocation API
```typescript
// 現在位置の取得
navigator.geolocation.getCurrentPosition(
  (position) => {
    const { latitude, longitude } = position.coords;
    // 位置情報の処理
  },
  (error) => {
    // エラーハンドリング
  },
  {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000
  }
);
```

### Google Maps統合
- マーカーの動的な追加・削除
- ユーザー位置の中心表示
- クーポン店舗の位置表示
- インタラクティブなマップ操作

## スタイリング

### CSS設計
- **モジュール化**: コンポーネント毎にCSSファイル
- **レスポンシブデザイン**: モバイルファーストアプローチ
- **カスタムプロパティ**: CSS変数の活用
- **アニメーション**: CSS Transitionとanimation

### 主要なスタイル
```css
/* カラーパレット */
--primary-color: #007bff;
--secondary-color: #6c757d;
--success-color: #28a745;
--warning-color: #ffc107;
--danger-color: #dc3545;

/* レスポンシブブレイクポイント */
@media (max-width: 768px) { /* モバイル */ }
@media (min-width: 769px) and (max-width: 1024px) { /* タブレット */ }
@media (min-width: 1025px) { /* デスクトップ */ }
```

## 開発ガイドライン

### TypeScript
- **厳密な型定義**: `types.ts`での集中管理
- **Propsの型定義**: 全コンポーネントでインターフェース定義
- **Null安全性**: Optional chainingとNullish coalescingの活用

### React Best Practices
- **関数コンポーネント**: Hooks APIの活用
- **カスタムフック**: ロジックの再利用
- **useEffect**: 副作用の適切な管理
- **パフォーマンス最適化**: React.memo、useMemo、useCallbackの活用

### State Management
- **Context API**: グローバル状態（認証）
- **useState**: ローカル状態
- **useReducer**: 複雑な状態ロジック

## テスト

### テスト構成
```bash
# 全テスト実行
npm test

# カバレッジ付きテスト
npm test -- --coverage

# ウォッチモード
npm test -- --watch
```

### テストライブラリ
- **React Testing Library**: コンポーネントテスト
- **Jest**: テストランナー・アサーション
- **@testing-library/user-event**: ユーザーインタラクションテスト

## ビルドと最適化

### プロダクションビルド
```bash
npm run build
```

### 最適化項目
- **Code Splitting**: React.lazy()による動的インポート
- **Tree Shaking**: 未使用コードの除去
- **Bundle Analysis**: `npm run analyze`でバンドルサイズ確認
- **Image Optimization**: 適切な画像フォーマットとサイズ

## デプロイメント

### Vercel デプロイ
```bash
# Vercel CLIインストール
npm i -g vercel

# デプロイ
vercel --prod
```

### 環境変数設定
Vercelダッシュボードで以下を設定:
- `REACT_APP_GOOGLE_MAPS_API_KEY`
- `REACT_APP_API_BASE_URL`

### ビルド設定
```json
// vercel.json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "buildCommand": "npm run build",
        "outputDirectory": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

## パフォーマンス最適化

### 実装済み最適化
- **遅延読み込み**: React.Suspenseとlazy loading
- **メモ化**: React.memo()による再レンダリング防止
- **デバウンス**: 検索機能での入力制御
- **画像最適化**: WebP形式の使用

### 監視とメトリクス
```typescript
// Web Vitals
import { reportWebVitals } from './reportWebVitals';
reportWebVitals(console.log);
```

## ブラウザ対応
- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### 必要なWebAPI
- **Geolocation API**: 位置情報取得
- **LocalStorage**: 認証Token保存
- **Fetch API**: HTTP通信

## トラブルシューティング

### よくある問題
1. **位置情報が取得できない**
   - HTTPSまたはlocalhostで実行
   - ブラウザの位置情報許可を確認

2. **Google Maps が表示されない**
   - APIキーの設定確認
   - Maps JavaScript APIの有効化確認

3. **認証エラー**
   - JWT Tokenの有効期限確認
   - CORS設定の確認

4. **ビルドエラー**
   - TypeScriptの型エラー確認
   - 依存関係の更新

### デバッグ方法
```bash
# 開発ツールでの確認項目
- Console: JavaScript エラー
- Network: API通信状況
- Application: LocalStorageの状態
- Location: 位置情報の許可状況
```

## 今後の改善予定
- **PWA対応**: Service Workerによるオフライン機能
- **プッシュ通知**: クーポン情報の通知
- **ダークモード**: UI テーマの切り替え
- **国際化**: 多言語対応
- **アクセシビリティ**: WAI-ARIA対応の向上

## 貢献

バグ報告や機能追加の提案を歓迎します。プルリクエストの際は:
- TypeScriptの型安全性を保持
- テストの追加
- ドキュメントの更新
- コードフォーマットの実行（Prettier）

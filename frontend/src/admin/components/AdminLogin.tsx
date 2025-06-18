import React, { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || '管理者ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h1>クーポン管理システム</h1>
          <p>店舗管理者ログイン</p>
        </div>
        
        <form onSubmit={handleSubmit} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="email">メールアドレス</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="パスワードを入力"
            />
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading}
            className="admin-login-button"
          >
            {loading ? '認証中...' : 'ログイン'}
          </button>
        </form>
        
        <div className="admin-login-footer">
          <p>店舗オーナー様、スーパー管理者専用画面です</p>
          <div className="demo-credentials">
            <small>
              デモ用アカウント:<br/>
              coffee@example.com / store1123<br/>
              restaurant@example.com / store2123<br/>
              bookstore@example.com / store3123
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
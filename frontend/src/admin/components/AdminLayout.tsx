import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { admin, store, logout } = useAdminAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || (path === '/dashboard' && location.pathname === '/');
  };

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-logo">
            <h1>🎫 クーポン管理</h1>
            {store && (
              <span className="store-name">{store.name}</span>
            )}
          </div>
          
          <div className="admin-user-info">
            <span className="admin-email">{admin?.email}</span>
            <span className="admin-role">
              {admin?.role === 'store_owner' ? '店舗オーナー' : 'スーパー管理者'}
            </span>
            <button onClick={logout} className="logout-button">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="admin-main">
        <nav className="admin-sidebar">
          <ul className="admin-nav-list">
            <li>
              <Link 
                to="/dashboard" 
                className={`admin-nav-item ${isActive('/dashboard') ? 'active' : ''}`}
              >
                📊 ダッシュボード
              </Link>
            </li>
            
            <li>
              <Link 
                to="/coupons" 
                className={`admin-nav-item ${isActive('/coupons') ? 'active' : ''}`}
              >
                🎫 クーポン管理
              </Link>
            </li>
            
            {admin?.role === 'super_admin' && (
              <li>
                <Link 
                  to="/stores" 
                  className={`admin-nav-item ${isActive('/stores') ? 'active' : ''}`}
                >
                  🏪 店舗管理
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
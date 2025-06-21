import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CouponHistoryPopup from './CouponHistoryPopup';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);

  return (
    <div style={{ 
      padding: '24px 16px', 
      maxWidth: '600px', 
      margin: '0 auto',
      background: '#f0f0f0',
      minHeight: 'calc(100vh - 140px)'
    }}>
      <div className="page-header" style={{ 
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h2 style={{ 
          margin: 0, 
          color: '#e6543a',
          fontSize: '24px',
          fontWeight: '700',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
        }}>
          ⚙️ 設定
        </h2>
      </div>
      
      <div style={{ 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '12px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <h3 style={{ 
          marginBottom: '20px', 
          color: '#333',
          fontSize: '18px',
          fontWeight: '600',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
        }}>
          👤 ユーザー情報
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            fontSize: '14px', 
            color: '#666', 
            marginBottom: '4px',
            fontWeight: '500'
          }}>
            ユーザー名
          </div>
          <div style={{ 
            fontSize: '16px', 
            color: '#333',
            fontWeight: '600'
          }}>
            {user?.name}
          </div>
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            fontSize: '14px', 
            color: '#666', 
            marginBottom: '4px',
            fontWeight: '500'
          }}>
            メールアドレス
          </div>
          <div style={{ 
            fontSize: '16px', 
            color: '#333',
            fontWeight: '600'
          }}>
            {user?.email}
          </div>
        </div>
        
        <button
          onClick={logout}
          style={{
            background: 'linear-gradient(135deg, #ff4444 0%, #e6543a 100%)',
            color: 'white',
            border: 'none',
            padding: '16px 24px',
            borderRadius: '12px',
            fontSize: '16px',
            cursor: 'pointer',
            fontWeight: '700',
            width: '100%',
            boxShadow: '0 4px 12px rgba(255,68,68,0.3)',
            transition: 'all 0.2s ease',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(255,68,68,0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,68,68,0.3)';
          }}
        >
          🚪 ログアウト
        </button>
      </div>

      <div style={{ 
        backgroundColor: 'white', 
        padding: '24px', 
        borderRadius: '12px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <h3 style={{ 
          marginBottom: '20px', 
          color: '#333',
          fontSize: '18px',
          fontWeight: '600',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
        }}>
          📋 クーポン履歴
        </h3>
        
        <p style={{ 
          fontSize: '14px', 
          color: '#666', 
          marginBottom: '16px',
          lineHeight: '1.5'
        }}>
          使用済み・期限切れのクーポンの履歴を確認できます
        </p>
        
        <button
          onClick={() => setShowHistoryPopup(true)}
          style={{
            background: 'white',
            color: '#e6543a',
            border: '2px solid #e6543a',
            padding: '12px 20px',
            borderRadius: '12px',
            fontSize: '16px',
            cursor: 'pointer',
            fontWeight: '600',
            width: '100%',
            transition: 'all 0.2s ease',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#e6543a';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = '#e6543a';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          📈 クーポン履歴を見る
        </button>
      </div>

      {showHistoryPopup && (
        <CouponHistoryPopup onClose={() => setShowHistoryPopup(false)} />
      )}
    </div>
  );
};

export default Settings;
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import CouponHistoryPopup from './CouponHistoryPopup';

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);

  return (
    <div className="settings-view">
      
      <div className="settings-section">
        <h3 className="section-title">ユーザー情報</h3>
        
        <div className="user-info">
          <div className="info-item">
            <div className="info-label">ユーザー名</div>
            <div className="info-value">{user?.name}</div>
          </div>
          
          <div className="info-item">
            <div className="info-label">メールアドレス</div>
            <div className="info-value">{user?.email}</div>
          </div>
        </div>
        
        <button onClick={logout} className="logout-btn">
          ログアウト
        </button>
      </div>

      <div className="settings-section">
        <h3 className="section-title">クーポン履歴</h3>
        
        <p className="section-description">
          使用済み・期限切れのクーポンの履歴を確認できます
        </p>
        
        <button onClick={() => setShowHistoryPopup(true)} className="history-btn">
          クーポン履歴を見る
        </button>
      </div>

      {showHistoryPopup && (
        <CouponHistoryPopup onClose={() => setShowHistoryPopup(false)} />
      )}
    </div>
  );
};

export default Settings;
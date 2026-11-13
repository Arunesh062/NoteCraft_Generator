import React from 'react';
import { User, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
import { UserProfile } from '../types/auth';

interface HeaderProps {
  user: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  backendOnline: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenAuth,
  onLogout,
  backendOnline,
}) => {
  return (
    <header className="header-bar">
      <div className="logo-area">
        <div className="logo-icon">
          <img src="/logo.png" alt="NoteCraft" onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="logo-title">NoteCraft Desktop</span>
          </div>
        </div>
      </div>

      <div className="header-status">
        <div className="status-pill">
          <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
          <span>{backendOnline ? 'Backend Connected' : 'Backend Standby'}</span>
        </div>

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="user-btn" onClick={onOpenAuth}>
              {user.isAnonymous ? (
                <AlertTriangle size={15} color="#F59E0B" />
              ) : (
                <CheckCircle2 size={15} color="#14B8A6" />
              )}
              <span>{user.displayName}</span>
            </button>
            <button
              className="user-btn"
              onClick={onLogout}
              title="Sign Out"
              style={{ padding: '8px 12px' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <button className="user-btn" onClick={onOpenAuth}>
            <User size={15} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};

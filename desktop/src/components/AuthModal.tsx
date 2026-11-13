import React, { useState } from 'react';
import { X, LogIn, ShieldCheck, UserCheck, AlertCircle, Mail, Lock, User as UserIcon, Loader2, Eye, EyeOff } from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmailLogin?: (email: string, pass: string) => Promise<void>;
  onEmailSignup?: (email: string, pass: string, name?: string) => Promise<void>;
  onGoogleLogin: () => void;
  onAnonymousLogin: () => void;
  error: string | null;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onEmailLogin,
  onEmailSignup,
  onGoogleLogin,
  onAnonymousLogin,
  error,
}) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseConfigured) {
      setLocalError('Firebase authentication is not configured in desktop environment.');
      return;
    }
    if (!email || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }
    if (isSignup && password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    try {
      setSubmitting(true);
      setLocalError(null);
      if (isSignup) {
        if (onEmailSignup) {
          await onEmailSignup(email, password, displayName);
        }
      } else {
        if (onEmailLogin) {
          await onEmailLogin(email, password);
        }
      }
      onClose();
    } catch (err: any) {
      setLocalError(err?.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const displayErr = localError || error;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content liquid-glass-card"
        style={{ maxWidth: '440px', marginTop: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Top Avatar Badge */}
        <div className="liquid-avatar-badge" title="NoteCraft User Security Sphere">
          <UserIcon size={26} strokeWidth={2.4} color="#FFFFFF" />
        </div>

        <div className="modal-header" style={{ marginTop: '12px' }}>
          <div style={{ textAlign: 'center', width: '100%' }}>
            <span className="modal-title" style={{ color: 'var(--color-text-primary)', fontSize: '20px', fontWeight: 800 }}>
              {isSignup ? 'Create NoteCraft Account' : 'Login'}
            </span>
          </div>
          <button className="btn-close" onClick={onClose} style={{ position: 'absolute', right: '16px', top: '16px' }}>
            <X size={20} />
          </button>
        </div>

        {!isFirebaseConfigured && (
          <div className="info-callout" style={{ borderColor: '#EF4444', color: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '12px' }}>
              <strong>Firebase Configuration Warning:</strong> Credentials missing. Cloud sync disabled.
            </div>
          </div>
        )}

        {displayErr && (
          <div className="info-callout" style={{ borderColor: '#EF4444', color: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '12px' }}>{displayErr}</div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="liquid-tab-switcher">
          <button
            type="button"
            className={`liquid-tab-btn ${!isSignup ? 'active' : ''}`}
            onClick={() => {
              setIsSignup(false);
              setLocalError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`liquid-tab-btn ${isSignup ? 'active' : ''}`}
            onClick={() => {
              setIsSignup(true);
              setLocalError(null);
            }}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isSignup && (
            <div className="liquid-glass-input-wrapper">
              <UserIcon size={18} className="liquid-input-icon" />
              <input
                type="text"
                placeholder="Full Name (Optional)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!isFirebaseConfigured || submitting}
                className="liquid-glass-input"
              />
            </div>
          )}

          <div className="liquid-glass-input-wrapper">
            <Mail size={18} className="liquid-input-icon" />
            <input
              type="email"
              required
              placeholder="User ID / Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!isFirebaseConfigured || submitting}
              className="liquid-glass-input"
            />
          </div>

          <div className="liquid-glass-input-wrapper">
            <Lock size={18} className="liquid-input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!isFirebaseConfigured || submitting}
              className="liquid-glass-input"
              style={{ paddingRight: '42px' }}
            />
            <button
              type="button"
              className="liquid-input-eye"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || !isFirebaseConfigured}
            className="liquid-glossy-btn"
            style={{ marginTop: '4px' }}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <LogIn size={18} />
                <span>{isSignup ? 'Create Account' : 'Login'}</span>
              </>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0', gap: '12px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(45, 212, 191, 0.3)' }} />
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Or Login With
          </span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(45, 212, 191, 0.3)' }} />
        </div>

        {/* Circular Social Login Row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <button
            type="button"
            className="liquid-social-btn"
            disabled={!isFirebaseConfigured || submitting}
            onClick={() => {
              onGoogleLogin();
              onClose();
            }}
            title="Sign in with Google"
          >
            <ShieldCheck size={22} color="#4285F4" />
          </button>

          <button
            type="button"
            className="liquid-social-btn"
            onClick={() => {
              onAnonymousLogin();
              onClose();
            }}
            title="Continue as Guest (Local Storage Only)"
          >
            <UserCheck size={22} color="#14B8A6" />
          </button>
        </div>
      </div>
    </div>
  );
};

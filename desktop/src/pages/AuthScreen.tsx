import React, { useState } from 'react';
import { LogIn, ShieldCheck, UserCheck, AlertCircle, Mail, Lock, User as UserIcon, Loader2, Eye, EyeOff, Sparkles } from 'lucide-react';
import { isFirebaseConfigured } from '../services/firebase';
import { formatAuthError } from '../services/authService';

interface AuthScreenProps {
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailSignup: (email: string, pass: string, name?: string) => Promise<void>;
  onGoogleLogin: () => void;
  onAnonymousLogin: () => void;
  error: string | null;
  backendOnline: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onEmailLogin,
  onEmailSignup,
  onGoogleLogin,
  onAnonymousLogin,
  error,
  backendOnline,
}) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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
        await onEmailSignup(email, password, displayName);
      } else {
        await onEmailLogin(email, password);
      }
    } catch (err: any) {
      setLocalError(formatAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const rawErr = localError || error;
  const displayErr = rawErr ? formatAuthError(rawErr) : null;

  return (
    <div className="auth-bg-container">
      {/* 3D Liquid Water Splash & Animated Droplets */}
      <div className="liquid-splash-bg" />
      <div className="water-droplet water-droplet-1" />
      <div className="water-droplet water-droplet-2" />
      <div className="water-droplet water-droplet-3" />
      <div className="water-droplet water-droplet-4" />

      {/* Top Glass Header Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '16px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.8)',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="logo-icon" style={{ boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)' }}>
            <Sparkles size={20} color="#FFFFFF" />
          </div>
          <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            NoteCraft Desktop
          </span>
        </div>

        <div className="status-pill" style={{ background: 'rgba(255, 255, 255, 0.9)', borderColor: 'rgba(45, 212, 191, 0.4)' }}>
          <span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />
          <span style={{ fontWeight: 600 }}>{backendOnline ? 'Backend Connected' : 'Backend Standby'}</span>
        </div>
      </div>

      {/* Centered 3D Liquid Glass Card */}
      <div className="liquid-glass-card">
        {/* Floating Top Avatar Badge */}
        <div className="liquid-avatar-badge" title="NoteCraft User Security Sphere">
          <UserIcon size={26} strokeWidth={2.4} color="#FFFFFF" />
        </div>

        <div style={{ textAlign: 'center', marginTop: '14px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            {isSignup ? 'Create Account' : 'Login'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px', fontWeight: 500 }}>
            {isSignup ? 'Join NoteCraft to sync AI notes.' : 'Welcome Back! Please login to continue.'}
          </p>
        </div>

        {!isFirebaseConfigured && (
          <div className="info-callout animate-error-shake" style={{ borderColor: '#EF4444', color: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '12px' }}>
              <strong>Firebase Warning:</strong> Cloud sync disabled (missing credentials).
            </div>
          </div>
        )}

        {displayErr && (
          <div className="info-callout animate-error-shake" style={{ borderColor: '#EF4444', color: '#EF4444', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', margin: '6px 0', gap: '12px' }}>
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
            onClick={onGoogleLogin}
            title="Sign in with Google"
          >
            <ShieldCheck size={22} color="#4285F4" />
          </button>

          <button
            type="button"
            className="liquid-social-btn"
            onClick={onAnonymousLogin}
            title="Continue as Guest (Local Storage Only)"
          >
            <UserCheck size={22} color="#14B8A6" />
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Loader2, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAuthErrorMessage } from '../utils/authErrors';

const Login = ({ onSwitchToSignup }) => {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Pre-submission validation
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email.trim(), password);
    } catch (err) {
      console.error('Login error:', err);
      setError(getAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="nc-auth-container">
      <div className="nc-auth-header">
        <h2 className="nc-auth-title">Welcome Back</h2>
        <p className="nc-auth-subtitle">Sign in to access NoteCraft AI</p>
      </div>

      {error && (
        <div className="nc-auth-error-banner">
          <AlertCircle size={14} className="nc-auth-error-icon" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="nc-auth-form" noValidate>
        <div className="nc-auth-field">
          <label className="nc-auth-label" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="nc-auth-input"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            autoComplete="email"
          />
        </div>

        <div className="nc-auth-field">
          <label className="nc-auth-label" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            className="nc-auth-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="nc-btn nc-btn-primary nc-auth-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="nc-spin" /> Signing in…
            </>
          ) : (
            <>
              <LogIn size={16} /> Login
            </>
          )}
        </button>
      </form>

      <div className="nc-auth-footer">
        <span>Don't have an account?</span>
        <button
          type="button"
          className="nc-auth-link-btn"
          onClick={onSwitchToSignup}
          disabled={isSubmitting}
        >
          Create account
        </button>
      </div>
    </div>
  );
};

export default Login;

import React, { useState } from 'react';
import { Loader2, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAuthErrorMessage } from '../utils/authErrors';

const Signup = ({ onSwitchToLogin }) => {
  const { signup } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Field Validations
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      await signup(email.trim(), password, name.trim());
    } catch (err) {
      console.error('Signup error:', err);
      setError(getAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="nc-auth-container">
      <div className="nc-auth-header">
        <h2 className="nc-auth-title">Create Account</h2>
        <p className="nc-auth-subtitle">Get started with NoteCraft AI</p>
      </div>

      {error && (
        <div className="nc-auth-error-banner">
          <AlertCircle size={14} className="nc-auth-error-icon" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="nc-auth-form" noValidate>
        <div className="nc-auth-field">
          <label className="nc-auth-label" htmlFor="signup-name">Full Name</label>
          <input
            id="signup-name"
            type="text"
            className="nc-auth-input"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            autoComplete="name"
          />
        </div>

        <div className="nc-auth-field">
          <label className="nc-auth-label" htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
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
          <label className="nc-auth-label" htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            type="password"
            className="nc-auth-input"
            placeholder="Min. 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            autoComplete="new-password"
          />
        </div>

        <div className="nc-auth-field">
          <label className="nc-auth-label" htmlFor="signup-confirm-password">Confirm Password</label>
          <input
            id="signup-confirm-password"
            type="password"
            className="nc-auth-input"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isSubmitting}
            autoComplete="new-password"
          />
        </div>

        <button
          type="submit"
          className="nc-btn nc-btn-primary nc-auth-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="nc-spin" /> Creating Account…
            </>
          ) : (
            <>
              <UserPlus size={16} /> Create Account
            </>
          )}
        </button>
      </form>

      <div className="nc-auth-footer">
        <span>Already have an account?</span>
        <button
          type="button"
          className="nc-auth-link-btn"
          onClick={onSwitchToLogin}
          disabled={isSubmitting}
        >
          Login
        </button>
      </div>
    </div>
  );
};

export default Signup;

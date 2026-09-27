/**
 * Maps raw Firebase authentication error codes to clean, user-friendly error messages.
 * Prevents raw Firebase error objects or internal codes from being shown to users.
 *
 * @param {Error|Object} error - The Firebase error object
 * @returns {string} - Human-readable error message
 */
export function getAuthErrorMessage(error) {
  if (!error) return 'An unexpected error occurred.';
  
  const code = error.code || '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/missing-email':
      return 'Please enter your email address.';
    case 'auth/popup-closed-by-user':
      return 'Authentication popup was closed before completing.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Console.';
    default:
      if (typeof error === 'string') return error;
      return error.message || 'Authentication failed. Please check your credentials and try again.';
  }
}

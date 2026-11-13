import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User,
  signInAnonymously,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';
import { UserProfile } from '../types/auth';

export const getCurrentUserProfile = (user: User | null): UserProfile | null => {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || (user.isAnonymous ? 'Guest User' : 'NoteCraft User'),
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  };
};

export const subscribeToAuthChanges = (
  callback: (user: UserProfile | null) => void
): (() => void) => {
  if (isFirebaseConfigured && auth) {
    return onAuthStateChanged(auth, (firebaseUser) => {
      callback(getCurrentUserProfile(firebaseUser));
    });
  }

  callback(null);
  return () => {};
};

export const loginWithEmail = async (email: string, password: string): Promise<UserProfile> => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase authentication is not configured. Please check application settings.');
  }
  const result = await signInWithEmailAndPassword(auth, email, password);
  const profile = getCurrentUserProfile(result.user);
  if (!profile) throw new Error('Failed to parse user profile');
  return profile;
};

export const signupWithEmail = async (
  email: string,
  password: string,
  displayName?: string
): Promise<UserProfile> => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase authentication is not configured. Please check application settings.');
  }
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && result.user) {
    await updateProfile(result.user, { displayName });
  }
  const profile = getCurrentUserProfile(result.user);
  if (!profile) throw new Error('Failed to parse user profile after signup');
  return profile;
};

export const loginWithGoogle = async (): Promise<UserProfile> => {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase authentication is not configured. Please check application settings.');
  }
  const result = await signInWithPopup(auth, googleProvider);
  const profile = getCurrentUserProfile(result.user);
  if (!profile) throw new Error('Failed to parse user profile');
  return profile;
};

export const loginWithAnonymous = async (): Promise<UserProfile> => {
  if (!isFirebaseConfigured || !auth) {
    return {
      uid: 'guest_' + Date.now(),
      email: null,
      displayName: 'Guest User',
      photoURL: null,
      isAnonymous: true,
    };
  }
  try {
    const result = await signInAnonymously(auth);
    const profile = getCurrentUserProfile(result.user);
    if (!profile) throw new Error('Failed to create guest user');
    return profile;
  } catch (err) {
    console.warn('[authService] Firebase anonymous login failed, using local guest fallback:', err);
    return {
      uid: 'guest_' + Date.now(),
      email: null,
      displayName: 'Guest User',
      photoURL: null,
      isAnonymous: true,
    };
  }
};

export const logoutUser = async (): Promise<void> => {
  if (isFirebaseConfigured && auth) {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('[authService] SignOut error ignored:', err);
    }
  }
};

export const formatAuthError = (err: any): string => {
  if (typeof err === 'string') return err;
  const rawMsg = err?.message || '';
  const code = err?.code || '';

  if (
    code === 'auth/invalid-api-key' ||
    code === 'auth/api-key-not-valid' ||
    rawMsg.includes('api-key-not-valid') ||
    rawMsg.includes('invalid-api-key')
  ) {
    return 'Invalid Firebase Web API Key. Please update VITE_FIREBASE_API_KEY in desktop/.env or click "Continue as Guest".';
  }

  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address format.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    default:
      return rawMsg || 'Authentication error occurred.';
  }
};



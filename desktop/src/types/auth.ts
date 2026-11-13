export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

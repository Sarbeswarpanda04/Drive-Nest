/**
 * Drive Nest - Authentication Module
 * Handles Firebase Authentication with Google Sign-in
 */

import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Import Firebase app and auth from centralized config
import { auth, firebaseConfig } from './firebase-config.js';

// Since we have real Firebase config now, not in demo mode
const isDemoMode = false;

console.log('🔥 Auth: Connected to Firebase project:', firebaseConfig.projectId);
console.log('✅ Full Firebase functionality enabled');

// Configure persistence
setPersistence(auth, browserSessionPersistence).then(() => {
  console.log('✅ Auth persistence set to session');
}).catch((error) => {
  console.warn('⚠️ Failed to set persistence:', error);
});

// Configure Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

class AuthService {
  constructor() {
    this.auth = auth;
    this.currentUser = null;
    this.authStateListeners = [];
    this.isDemoMode = isDemoMode;
    
    // Listen to auth state changes
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.notifyAuthStateListeners(user);
    });
  }

  /**
   * Sign in with Google using popup
   * @returns {Promise<UserCredential>} User credential
   */
  async signInWithGoogle() {
    try {
      console.log('Starting Google sign-in...');
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      console.log('Sign-in successful:', user.email);
      
      // Log user info for debugging
      console.log('User info:', {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      });
      
      return result;
      
    } catch (error) {
      console.error('Google sign-in error:', error);
      
      let errorMessage = 'Failed to sign in with Google';
      
      switch (error.code) {
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in was cancelled';
          break;
        case 'auth/popup-blocked':
          errorMessage = 'Pop-up was blocked by the browser. Please allow pop-ups for this site.';
          break;
        case 'auth/cancelled-popup-request':
          errorMessage = 'Sign-in was cancelled';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled';
          break;
        default:
          if (error.message) {
            errorMessage = error.message;
          }
      }
      
      // Show error to user
      if (window.showToast) {
        window.showToast(errorMessage, 'error');
      } else {
        alert(errorMessage);
      }
      
      throw error;
    }
  }

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      console.log('Signing out user...');
      
      await firebaseSignOut(auth);
      
      console.log('Sign-out successful');
      
      // Show success message
      if (window.showToast) {
        window.showToast('Signed out successfully', 'success');
      }
      
    } catch (error) {
      console.error('Sign-out error:', error);
      
      // Show error to user
      if (window.showToast) {
        window.showToast('Failed to sign out', 'error');
      } else {
        alert('Failed to sign out');
      }
      
      throw error;
    }
  }

  /**
   * Get the current user
   * @returns {User|null} Current user or null if not signed in
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user is signed in
   * @returns {boolean} True if user is signed in
   */
  isSignedIn() {
    return this.currentUser !== null;
  }

  /**
   * Get current user's ID token
   * @returns {Promise<string>} ID token
   */
  async getIdToken() {
    if (!this.currentUser) {
      throw new Error('User not signed in');
    }
    
    try {
      return await this.currentUser.getIdToken();
    } catch (error) {
      console.error('Error getting ID token:', error);
      throw error;
    }
  }

  /**
   * Get current user's ID token (forced refresh)
   * @returns {Promise<string>} Fresh ID token
   */
  async getIdTokenFresh() {
    if (!this.currentUser) {
      throw new Error('User not signed in');
    }
    
    try {
      return await this.currentUser.getIdToken(true);
    } catch (error) {
      console.error('Error getting fresh ID token:', error);
      throw error;
    }
  }

  /**
   * Add auth state change listener
   * @param {Function} callback Callback function that receives the user object
   */
  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this.authStateListeners.push(callback);
      // Immediately call with current user
      callback(this.currentUser);
    }
  }

  /**
   * Remove auth state change listener
   * @param {Function} callback Callback function to remove
   */
  offAuthStateChanged(callback) {
    const index = this.authStateListeners.indexOf(callback);
    if (index > -1) {
      this.authStateListeners.splice(index, 1);
    }
  }

  /**
   * Notify all auth state listeners
   * @param {User|null} user Current user
   */
  notifyAuthStateListeners(user) {
    this.authStateListeners.forEach(callback => {
      try {
        callback(user);
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  /**
   * Wait for auth state to be determined
   * @returns {Promise<User|null>} Current user once auth state is determined
   */
  waitForAuth() {
    return new Promise((resolve) => {
      if (auth.currentUser !== undefined) {
        resolve(auth.currentUser);
        return;
      }
      
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  /**
   * Reauthenticate user (useful before sensitive operations)
   * @returns {Promise<UserCredential>} User credential
   */
  async reauthenticate() {
    if (!this.currentUser) {
      throw new Error('User not signed in');
    }
    
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Reauthentication error:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   * @returns {Promise<void>}
   */
  async deleteAccount() {
    if (!this.currentUser) {
      throw new Error('User not signed in');
    }
    
    try {
      // Note: This might require recent authentication
      await this.currentUser.delete();
      console.log('Account deleted successfully');
    } catch (error) {
      console.error('Account deletion error:', error);
      
      if (error.code === 'auth/requires-recent-login') {
        // Try reauthentication first
        try {
          await this.reauthenticate();
          await this.currentUser.delete();
          console.log('Account deleted successfully after reauthentication');
        } catch (reauthError) {
          console.error('Account deletion failed after reauthentication:', reauthError);
          throw reauthError;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Update user profile
   * @param {Object} profile Profile updates
   * @returns {Promise<void>}
   */
  async updateProfile(profile) {
    if (!this.currentUser) {
      throw new Error('User not signed in');
    }
    
    try {
      const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      await updateProfile(this.currentUser, profile);
      console.log('Profile updated successfully');
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }

  /**
   * Get user metadata
   * @returns {Object|null} User metadata or null if not signed in
   */
  getUserMetadata() {
    if (!this.currentUser) {
      return null;
    }
    
    return {
      creationTime: this.currentUser.metadata.creationTime,
      lastSignInTime: this.currentUser.metadata.lastSignInTime
    };
  }

  /**
   * Check if user email is verified
   * @returns {boolean} True if user is verified
   */
  isEmailVerified() {
    return this.currentUser?.emailVerified || false;
  }

  /**
   * Send email verification
   * @returns {Promise<void>}
   */
  async sendEmailVerification() {
    if (!this.currentUser) {
      throw new Error('User not signed in');
    }
    
    try {
      const { sendEmailVerification } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
      await sendEmailVerification(this.currentUser);
      console.log('Email verification sent');
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }
}

// Create and export auth service instance
const authService = new AuthService();

// Make available globally for HTML timeout check and as authManager alias
window.authManager = authService;
const authManager = authService;

// Export auth instance for direct Firebase auth access
export { auth, authManager };

// Export auth service as default
export default authService;

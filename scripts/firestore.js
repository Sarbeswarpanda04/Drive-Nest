/**
 * Drive Nest - Firestore Module
 * Handles Firestore database operations for file metadata and sharing
 */

import { 
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  writeBatch,
  onSnapshot,
  arrayUnion,
  arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Import Firebase app and db from centralized config
import { db, firebaseConfig } from './firebase-config.js';

// Since we have real Firebase config now, not in demo mode
const isDemoMode = false;

console.log('🔥 Firestore: Connected to Firebase project:', firebaseConfig.projectId);
console.log('✅ Full Firebase functionality enabled');

class FirestoreService {
  constructor() {
    this.db = db;
    this.listeners = new Map(); // Store active listeners
    this.isDemoMode = isDemoMode;
    
    if (this.isDemoMode) {
      this.demoFiles = this.generateDemoFiles(); // Demo data
    }
  }

  /**
   * Generate demo files for demo mode
   */
  generateDemoFiles() {
    return [
      {
        id: 'demo-1',
        name: 'Welcome to Drive Nest.pdf',
        size: 2458742,
        type: 'application/pdf',
        mimeType: 'application/pdf',
        path: 'demo/welcome.pdf',
        url: 'https://via.placeholder.com/800x600/4F46E5/FFFFFF?text=Welcome+to+Drive+Nest',
        uploadedAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
        uploadedBy: 'demo-user-123',
        ownerEmail: 'demo@example.com',
        starred: false,
        shared: false,
        trash: false
      },
      {
        id: 'demo-2',
        name: 'Project Presentation.pptx',
        size: 5242880,
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        path: 'demo/presentation.pptx',
        url: 'https://via.placeholder.com/800x600/10B981/FFFFFF?text=Project+Presentation',
        uploadedAt: new Date(Date.now() - 86400000), // 1 day ago
        uploadedBy: 'demo-user-123',
        ownerEmail: 'demo@example.com',
        starred: true,
        shared: false,
        trash: false
      },
      {
        id: 'demo-3',
        name: 'Team Photo.jpg',
        size: 1048576,
        type: 'image/jpeg',
        mimeType: 'image/jpeg',
        path: 'demo/photo.jpg',
        url: 'https://via.placeholder.com/800x600/F59E0B/FFFFFF?text=Team+Photo',
        uploadedAt: new Date(Date.now() - 3600000), // 1 hour ago
        uploadedBy: 'demo-user-123',
        ownerEmail: 'demo@example.com',
        starred: false,
        shared: true,
        trash: false
      },
      {
        id: 'demo-4',
        name: 'Meeting Notes.docx',
        size: 524288,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        path: 'demo/notes.docx',
        url: 'https://via.placeholder.com/800x600/8B5CF6/FFFFFF?text=Meeting+Notes',
        uploadedAt: new Date(),
        uploadedBy: 'demo-user-123',
        ownerEmail: 'demo@example.com',
        starred: false,
        shared: false,
        trash: false
      }
    ];
  }

  // ============ FILE OPERATIONS ============

  /**
   * Save file metadata to Firestore
   * @param {Object} fileData File metadata
   * @returns {Promise<string>} Document ID
   */
  async saveFileMetadata(fileData) {
    try {
      const user = window.authManager?.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const docRef = doc(collection(this.db, 'files'));
      
      // Ensure only serializable data is saved
      const fileDoc = {
        id: docRef.id,
        name: String(fileData.name || ''),
        size: Number(fileData.size || 0),
        mimeType: String(fileData.mimeType || ''),
        path: String(fileData.path || ''),
        url: String(fileData.url || ''),
        ownerId: String(user.uid),
        created: Timestamp.now(),
        modified: Timestamp.now(),
        uploadedAt: fileData.uploadedAt ? Timestamp.fromDate(new Date(fileData.uploadedAt)) : Timestamp.now(),
        starred: false,
        trashed: false,
        version: 1,
        tags: Array.isArray(fileData.tags) ? fileData.tags : [],
        sharedWith: [],
        sharedLinks: []
      };
      
      await setDoc(docRef, fileDoc);
      console.log('File metadata saved:', docRef.id);
      
      // Log activity
      await this.logActivity({
        action: 'upload',
        fileId: docRef.id,
        fileName: fileData.name,
        userId: user.uid,
        timestamp: Timestamp.now()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Error saving file metadata:', error);
      throw error;
    }
  }

  /**
   * Get file metadata by ID
   * @param {string} fileId File ID
   * @returns {Promise<Object|null>} File metadata
   */
  async getFileMetadata(fileId) {
    try {
      const docRef = doc(this.db, 'files', fileId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Update file metadata
   * @param {string} fileId File ID
   * @param {Object} updates Updates to apply
   * @returns {Promise<void>}
   */
  async updateFileMetadata(fileId, updates) {
    try {
      const docRef = doc(this.db, 'files', fileId);
      await updateDoc(docRef, {
        ...updates,
        modified: Timestamp.now()
      });
      
      console.log('File metadata updated:', fileId);
    } catch (error) {
      console.error('Error updating file metadata:', error);
      throw error;
    }
  }

  /**
   * Delete file metadata
   * @param {string} fileId File ID
   * @returns {Promise<void>}
   */
  async deleteFileMetadata(fileId) {
    try {
      const docRef = doc(this.db, 'files', fileId);
      await deleteDoc(docRef);
      console.log('File metadata deleted:', fileId);
    } catch (error) {
      console.error('Error deleting file metadata:', error);
      throw error;
    }
  }

  // ============ FILE QUERIES ============

  /**
   * Get user's files
   * @param {string} userId User ID
   * @param {Array} path Folder path
   * @param {Object} options Query options
   * @returns {Promise<Array>} List of files
   */
  async getUserFiles(userId, path = [], options = {}) {
    try {
      if (this.isDemoMode) {
        console.log('Demo mode: Returning demo files');
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return this.demoFiles.filter(file => !file.trash);
      }
      
      const filesRef = collection(this.db, 'files');
      const pathString = path.join('/');
      
      // Query for files owned by user (check both ownerId and uploadedBy)
      let q1 = query(
        filesRef,
        where('ownerId', '==', userId),
        where('trashed', '==', false)
      );
      
      let q2 = query(
        filesRef,
        where('uploadedBy', '==', userId),
        where('trashed', '==', false)
      );
      
      // Execute both queries
      const [querySnapshot1, querySnapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);
      
      // Combine results and remove duplicates
      const filesMap = new Map();
      
      querySnapshot1.docs.forEach(doc => {
        filesMap.set(doc.id, {
          id: doc.id,
          ...doc.data(),
          created: doc.data().created?.toDate(),
          modified: doc.data().modified?.toDate()
        });
      });
      
      querySnapshot2.docs.forEach(doc => {
        if (!filesMap.has(doc.id)) {
          filesMap.set(doc.id, {
            id: doc.id,
            ...doc.data(),
            created: doc.data().created?.toDate(),
            modified: doc.data().modified?.toDate()
          });
        }
      });
      
      let files = Array.from(filesMap.values());
      
      console.log('All files found before path filtering:', files.length);
      console.log('Looking for path:', pathString);
      files.forEach(file => {
        console.log('File data:', {
          name: file.name,
          path: file.path, 
          type: file.type,
          mimeType: file.mimeType,
          size: file.size,
          ownerId: file.ownerId,
          uploadedBy: file.uploadedBy
        });
      });
      
      // Filter by path in JavaScript (client-side filtering)
      // For root path, show files with empty path or path that matches
      if (pathString === '' || pathString === '/') {
        files = files.filter(file => !file.path || file.path === '' || file.path === '/');
      } else {
        files = files.filter(file => (file.path || '') === pathString);
      }
      
      console.log('Files after path filtering:', files.length);
      
      // Sort by modified date (client-side sorting)
      const orderField = options.orderBy || 'modified';
      const orderDirection = options.orderDirection || 'desc';
      files.sort((a, b) => {
        const aValue = a[orderField];
        const bValue = b[orderField];
        
        if (orderDirection === 'desc') {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });
      
      // Apply limit
      if (options.limit) {
        files = files.slice(0, options.limit);
      }
      
      return files;
      
    } catch (error) {
      console.error('Error getting user files:', error);
      throw error;
    }
  }

  /**
   * Get files shared with user
   * @param {string} userId User ID
   * @param {Object} options Query options
   * @returns {Promise<Array>} List of shared files
   */
  async getSharedFiles(userId, options = {}) {
    try {
      const filesRef = collection(this.db, 'files');
      
      let q = query(
        filesRef,
        where('sharedWith', 'array-contains', userId),
        where('trashed', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      let files = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created: doc.data().created?.toDate(),
        modified: doc.data().modified?.toDate()
      }));
      
      // Sort by modified date (client-side)
      files.sort((a, b) => b.modified - a.modified);
      
      // Apply limit
      if (options.limit) {
        files = files.slice(0, options.limit);
      }
      
      return files;
      
    } catch (error) {
      console.error('Error getting shared files:', error);
      throw error;
    }
  }

  /**
   * Get starred files
   * @param {string} userId User ID
   * @param {Object} options Query options
   * @returns {Promise<Array>} List of starred files
   */
  async getStarredFiles(userId, options = {}) {
    try {
      const filesRef = collection(this.db, 'files');
      
      let q = query(
        filesRef,
        where('ownerId', '==', userId),
        where('starred', '==', true),
        where('trashed', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      let files = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created: doc.data().created?.toDate(),
        modified: doc.data().modified?.toDate()
      }));
      
      // Sort by modified date (client-side)
      files.sort((a, b) => b.modified - a.modified);
      
      // Apply limit
      if (options.limit) {
        files = files.slice(0, options.limit);
      }
      
      return files;
      
    } catch (error) {
      console.error('Error getting starred files:', error);
      throw error;
    }
  }

  /**
   * Get recent files
   * @param {string} userId User ID
   * @param {Object} options Query options
   * @returns {Promise<Array>} List of recent files
   */
  async getRecentFiles(userId, options = {}) {
    try {
      const filesRef = collection(this.db, 'files');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      let q = query(
        filesRef,
        where('ownerId', '==', userId),
        where('modified', '>=', Timestamp.fromDate(sevenDaysAgo)),
        where('trashed', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      let files = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created: doc.data().created?.toDate(),
        modified: doc.data().modified?.toDate()
      }));
      
      // Sort by modified date (client-side)
      files.sort((a, b) => b.modified - a.modified);
      
      // Apply limit
      const limit = options.limit || 50; // Default limit for recent files
      files = files.slice(0, limit);
      
      return files;
      
    } catch (error) {
      console.error('Error getting recent files:', error);
      throw error;
    }
  }

  /**
   * Get trashed files
   * @param {string} userId User ID
   * @param {Object} options Query options
   * @returns {Promise<Array>} List of trashed files
   */
  async getTrashedFiles(userId, options = {}) {
    try {
      const filesRef = collection(this.db, 'files');
      
      let q = query(
        filesRef,
        where('ownerId', '==', userId),
        where('trashed', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      let files = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created: doc.data().created?.toDate(),
        modified: doc.data().modified?.toDate(),
        trashedAt: doc.data().trashedAt?.toDate()
      }));
      
      // Sort by trashedAt date (client-side)
      files.sort((a, b) => b.trashedAt - a.trashedAt);
      
      // Apply limit
      if (options.limit) {
        files = files.slice(0, options.limit);
      }
      
      return files;
      
    } catch (error) {
      console.error('Error getting trashed files:', error);
      throw error;
    }
  }

  // ============ FILE ACTIONS ============

  /**
   * Star/unstar a file
   * @param {string} fileId File ID
   * @param {boolean} starred Star state
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async starFile(fileId, starred, userId) {
    try {
      await this.updateFileMetadata(fileId, { starred });
      
      // Log activity
      await this.logActivity({
        action: starred ? 'star' : 'unstar',
        fileId,
        userId,
        timestamp: Timestamp.now()
      });
      
      console.log(`File ${starred ? 'starred' : 'unstarred'}:`, fileId);
    } catch (error) {
      console.error('Error starring file:', error);
      throw error;
    }
  }

  /**
   * Move file to trash
   * @param {string} fileId File ID
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async trashFile(fileId, userId) {
    try {
      await this.updateFileMetadata(fileId, {
        trashed: true,
        trashedAt: Timestamp.now()
      });
      
      // Log activity
      await this.logActivity({
        action: 'trash',
        fileId,
        userId,
        timestamp: Timestamp.now()
      });
      
      console.log('File trashed:', fileId);
    } catch (error) {
      console.error('Error trashing file:', error);
      throw error;
    }
  }

  /**
   * Restore file from trash
   * @param {string} fileId File ID
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async restoreFile(fileId, userId) {
    try {
      await this.updateFileMetadata(fileId, {
        trashed: false,
        trashedAt: null
      });
      
      // Log activity
      await this.logActivity({
        action: 'restore',
        fileId,
        userId,
        timestamp: Timestamp.now()
      });
      
      console.log('File restored:', fileId);
    } catch (error) {
      console.error('Error restoring file:', error);
      throw error;
    }
  }

  /**
   * Permanently delete file
   * @param {string} fileId File ID
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async permanentDeleteFile(fileId, userId) {
    try {
      // Log activity before deletion
      await this.logActivity({
        action: 'permanent_delete',
        fileId,
        userId,
        timestamp: Timestamp.now()
      });
      
      await this.deleteFileMetadata(fileId);
      console.log('File permanently deleted:', fileId);
    } catch (error) {
      console.error('Error permanently deleting file:', error);
      throw error;
    }
  }

  /**
   * Rename file
   * @param {string} fileId File ID
   * @param {string} newName New file name
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async renameFile(fileId, newName, userId) {
    try {
      await this.updateFileMetadata(fileId, { name: newName });
      
      // Log activity
      await this.logActivity({
        action: 'rename',
        fileId,
        fileName: newName,
        userId,
        timestamp: Timestamp.now()
      });
      
      console.log('File renamed:', fileId, newName);
    } catch (error) {
      console.error('Error renaming file:', error);
      throw error;
    }
  }

  /**
   * Move file to different path
   * @param {string} fileId File ID
   * @param {string} newPath New path
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async moveFile(fileId, newPath, userId) {
    try {
      await this.updateFileMetadata(fileId, { path: newPath });
      
      // Log activity
      await this.logActivity({
        action: 'move',
        fileId,
        userId,
        timestamp: Timestamp.now(),
        details: { newPath }
      });
      
      console.log('File moved:', fileId, newPath);
    } catch (error) {
      console.error('Error moving file:', error);
      throw error;
    }
  }

  // ============ SHARING OPERATIONS ============

  /**
   * Share file with users
   * @param {string} fileId File ID
   * @param {Array} emails User emails to share with
   * @param {string} permission Permission level (viewer, commenter, editor)
   * @param {string} userId User ID of sharer
   * @returns {Promise<void>}
   */
  async shareFileWithUsers(fileId, emails, permission, userId) {
    try {
      const docRef = doc(this.db, 'files', fileId);
      
      // Add sharing records
      const sharePromises = emails.map(email => 
        this.addUserShare(fileId, email, permission, userId)
      );
      
      await Promise.all(sharePromises);
      
      // Update file metadata
      await updateDoc(docRef, {
        sharedWith: arrayUnion(...emails),
        modified: Timestamp.now()
      });
      
      // Log activity
      await this.logActivity({
        action: 'share',
        fileId,
        userId,
        timestamp: Timestamp.now(),
        details: { emails, permission }
      });
      
      console.log('File shared with users:', fileId, emails);
    } catch (error) {
      console.error('Error sharing file with users:', error);
      throw error;
    }
  }

  /**
   * Create shareable link
   * @param {string} fileId File ID
   * @param {string} permission Permission level
   * @param {Date|null} expiresAt Expiration date
   * @param {string} userId User ID
   * @returns {Promise<string>} Share link ID
   */
  async createShareableLink(fileId, permission, expiresAt, userId) {
    try {
      const linkRef = doc(collection(this.db, 'shareLinks'));
      const linkData = {
        id: linkRef.id,
        fileId,
        permission,
        createdBy: userId,
        createdAt: Timestamp.now(),
        expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
        accessCount: 0,
        active: true
      };
      
      await setDoc(linkRef, linkData);
      
      // Update file metadata
      const fileRef = doc(this.db, 'files', fileId);
      await updateDoc(fileRef, {
        sharedLinks: arrayUnion(linkRef.id),
        modified: Timestamp.now()
      });
      
      // Log activity
      await this.logActivity({
        action: 'create_link',
        fileId,
        userId,
        timestamp: Timestamp.now(),
        details: { linkId: linkRef.id, permission, expiresAt }
      });
      
      console.log('Shareable link created:', linkRef.id);
      return linkRef.id;
      
    } catch (error) {
      console.error('Error creating shareable link:', error);
      throw error;
    }
  }

  /**
   * Get share link data
   * @param {string} linkId Link ID
   * @returns {Promise<Object|null>} Link data
   */
  async getShareLink(linkId) {
    try {
      const docRef = doc(this.db, 'shareLinks', linkId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const linkData = docSnap.data();
        
        // Check if link is expired
        if (linkData.expiresAt && linkData.expiresAt.toDate() < new Date()) {
          return null;
        }
        
        // Increment access count
        await updateDoc(docRef, {
          accessCount: (linkData.accessCount || 0) + 1,
          lastAccessedAt: Timestamp.now()
        });
        
        return { id: docSnap.id, ...linkData };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting share link:', error);
      throw error;
    }
  }

  /**
   * Revoke share link
   * @param {string} linkId Link ID
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async revokeShareLink(linkId, userId) {
    try {
      await updateDoc(doc(this.db, 'shareLinks', linkId), {
        active: false,
        revokedAt: Timestamp.now(),
        revokedBy: userId
      });
      
      console.log('Share link revoked:', linkId);
    } catch (error) {
      console.error('Error revoking share link:', error);
      throw error;
    }
  }

  // ============ USER SHARES ============

  /**
   * Add user share record
   * @param {string} fileId File ID
   * @param {string} email User email
   * @param {string} permission Permission level
   * @param {string} sharedBy User who shared
   * @returns {Promise<void>}
   */
  async addUserShare(fileId, email, permission, sharedBy) {
    try {
      const shareRef = doc(collection(this.db, 'userShares'));
      const shareData = {
        id: shareRef.id,
        fileId,
        email,
        permission,
        sharedBy,
        sharedAt: Timestamp.now(),
        active: true
      };
      
      await setDoc(shareRef, shareData);
      console.log('User share added:', shareRef.id);
    } catch (error) {
      console.error('Error adding user share:', error);
      throw error;
    }
  }

  /**
   * Remove user share
   * @param {string} fileId File ID
   * @param {string} email User email
   * @param {string} userId Current user ID
   * @returns {Promise<void>}
   */
  async removeUserShare(fileId, email, userId) {
    try {
      // Find and deactivate share record
      const sharesRef = collection(this.db, 'userShares');
      const q = query(
        sharesRef,
        where('fileId', '==', fileId),
        where('email', '==', email),
        where('active', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(this.db);
      
      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, {
          active: false,
          removedAt: Timestamp.now(),
          removedBy: userId
        });
      });
      
      await batch.commit();
      
      // Update file metadata
      const fileRef = doc(this.db, 'files', fileId);
      await updateDoc(fileRef, {
        sharedWith: arrayRemove(email),
        modified: Timestamp.now()
      });
      
      console.log('User share removed:', fileId, email);
    } catch (error) {
      console.error('Error removing user share:', error);
      throw error;
    }
  }

  // ============ ACTIVITY LOG ============

  /**
   * Log user activity
   * @param {Object} activity Activity data
   * @returns {Promise<void>}
   */
  async logActivity(activity) {
    try {
      const activityRef = doc(collection(this.db, 'activities'));
      await setDoc(activityRef, {
        id: activityRef.id,
        ...activity
      });
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw error for activity logging failures
    }
  }

  /**
   * Get user activity log
   * @param {string} userId User ID
   * @param {number} limitCount Limit number of activities
   * @returns {Promise<Array>} Activity log
   */
  async getActivityLog(userId, limitCount = 50) {
    try {
      const activitiesRef = collection(this.db, 'activities');
      const q = query(
        activitiesRef,
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));
    } catch (error) {
      console.error('Error getting activity log:', error);
      throw error;
    }
  }

  // ============ SEARCH ============

  /**
   * Search files
   * @param {string} userId User ID
   * @param {string} searchTerm Search term
   * @param {Object} options Search options
   * @returns {Promise<Array>} Search results
   */
  async searchFiles(userId, searchTerm, options = {}) {
    try {
      // Basic search implementation
      // Note: Firestore doesn't support full-text search natively
      // For production, consider using Algolia or Elasticsearch
      
      const filesRef = collection(this.db, 'files');
      const q = query(
        filesRef,
        where('ownerId', '==', userId),
        where('trashed', '==', false)
      );
      
      const querySnapshot = await getDocs(q);
      const allFiles = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created: doc.data().created?.toDate(),
        modified: doc.data().modified?.toDate()
      }));
      
      // Sort by modified date (client-side)
      allFiles.sort((a, b) => b.modified - a.modified);
      
      // Filter by search term (client-side for now)
      const searchTermLower = searchTerm.toLowerCase();
      return allFiles.filter(file => 
        file.name.toLowerCase().includes(searchTermLower) ||
        (file.tags && file.tags.some(tag => tag.toLowerCase().includes(searchTermLower)))
      );
      
    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  // ============ REAL-TIME LISTENERS ============

  /**
   * Listen to user files changes
   * @param {string} userId User ID
   * @param {Function} callback Callback function
   * @returns {Function} Unsubscribe function
   */
  listenToUserFiles(userId, callback) {
    const filesRef = collection(this.db, 'files');
    const q = query(
      filesRef,
      where('ownerId', '==', userId),
      orderBy('modified', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const files = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created: doc.data().created?.toDate(),
        modified: doc.data().modified?.toDate()
      }));
      
      callback(files);
    }, (error) => {
      console.error('Error listening to user files:', error);
    });
    
    // Store listener for cleanup
    this.listeners.set(`userFiles_${userId}`, unsubscribe);
    
    return unsubscribe;
  }

  /**
   * Stop all listeners
   */
  stopAllListeners() {
    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.listeners.clear();
  }

  // ============ BATCH OPERATIONS ============

  /**
   * Batch delete files
   * @param {Array} fileIds Array of file IDs
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async batchDeleteFiles(fileIds, userId) {
    try {
      const batch = writeBatch(this.db);
      
      fileIds.forEach(fileId => {
        const docRef = doc(this.db, 'files', fileId);
        batch.delete(docRef);
      });
      
      await batch.commit();
      
      // Log activity for each file
      const activityPromises = fileIds.map(fileId =>
        this.logActivity({
          action: 'batch_delete',
          fileId,
          userId,
          timestamp: Timestamp.now()
        })
      );
      
      await Promise.all(activityPromises);
      console.log('Batch delete completed for:', fileIds);
    } catch (error) {
      console.error('Error batch deleting files:', error);
      throw error;
    }
  }

  /**
   * Batch move files
   * @param {Array} fileIds Array of file IDs
   * @param {string} newPath New path
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async batchMoveFiles(fileIds, newPath, userId) {
    try {
      const batch = writeBatch(this.db);
      
      fileIds.forEach(fileId => {
        const docRef = doc(this.db, 'files', fileId);
        batch.update(docRef, {
          path: newPath,
          modified: Timestamp.now()
        });
      });
      
      await batch.commit();
      
      // Log activity for each file
      const activityPromises = fileIds.map(fileId =>
        this.logActivity({
          action: 'batch_move',
          fileId,
          userId,
          timestamp: Timestamp.now(),
          details: { newPath }
        })
      );
      
      await Promise.all(activityPromises);
      console.log('Batch move completed for:', fileIds);
    } catch (error) {
      console.error('Error batch moving files:', error);
      throw error;
    }
  }

  /**
   * Save file document to Firestore (for Firestore-only storage)
   */
  async saveFile(fileDoc) {
    if (this.isDemoMode) {
      console.log('Demo Mode: Saving file document:', fileDoc.name);
      return { id: fileDoc.id };
    }

    try {
      // Ensure only serializable data is saved
      const cleanFileDoc = {
        id: String(fileDoc.id || ''),
        name: String(fileDoc.name || ''),
        size: Number(fileDoc.size || 0),
        type: String(fileDoc.type || ''),
        data: String(fileDoc.data || ''),
        path: String(fileDoc.path || ''),
        uploadedBy: String(fileDoc.uploadedBy || fileDoc.ownerId || ''),
        ownerId: String(fileDoc.ownerId || fileDoc.uploadedBy || ''),
        uploadedAt: fileDoc.uploadedAt instanceof Date ? Timestamp.fromDate(fileDoc.uploadedAt) : Timestamp.now(),
        created: fileDoc.created instanceof Date ? Timestamp.fromDate(fileDoc.created) : Timestamp.now(),
        modified: fileDoc.modified instanceof Date ? Timestamp.fromDate(fileDoc.modified) : Timestamp.now(),
        starred: Boolean(fileDoc.starred || false),
        trashed: Boolean(fileDoc.trashed || false),
        version: Number(fileDoc.version || 1),
        tags: Array.isArray(fileDoc.tags) ? fileDoc.tags : [],
        sharedWith: Array.isArray(fileDoc.sharedWith) ? fileDoc.sharedWith : []
      };

      await setDoc(doc(this.db, 'files', cleanFileDoc.id), cleanFileDoc);
      console.log('File document saved with ID:', cleanFileDoc.id);
      return { id: cleanFileDoc.id };
    } catch (error) {
      console.error('Error saving file document:', error);
      throw error;
    }
  }

  /**
   * Get file by path or ID (for Firestore-only storage)
   */
  async getFileByPath(pathOrId) {
    console.log('getFileByPath called with:', pathOrId);
    
    if (this.isDemoMode) {
      return this.getDemoFileByPath(pathOrId);
    }

    try {
      // First try to get by document ID
      try {
        console.log('Trying to get document by ID:', pathOrId);
        const docRef = doc(this.db, 'files', pathOrId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const fileData = { id: docSnap.id, ...docSnap.data() };
          console.log('Found file by ID:', fileData);
          return fileData;
        } else {
          console.log('Document not found by ID:', pathOrId);
        }
      } catch (e) {
        console.log('Error getting by ID, trying by path:', e);
        // If that fails, search by path or id field
      }

      // Search by path
      const pathQuery = query(
        collection(this.db, 'files'),
        where('path', '==', pathOrId),
        where('trashed', '==', false),
        limit(1)
      );
      
      const querySnapshot = await getDocs(pathQuery);

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }

      // Search by file ID field
      const idQuery = query(
        collection(this.db, 'files'),
        where('id', '==', pathOrId),
        where('trashed', '==', false),
        limit(1)
      );

      const idQuerySnapshot = await getDocs(idQuery);

      if (!idQuerySnapshot.empty) {
        const doc = idQuerySnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }

      return null;
    } catch (error) {
      console.error('Error getting file by path:', error);
      throw error;
    }
  }

  /**
   * Update file document (for Firestore-only storage)
   */
  async updateFile(fileId, updates) {
    if (this.isDemoMode) {
      console.log('Demo Mode: Updating file:', fileId, updates);
      return;
    }

    try {
      const docRef = doc(this.db, 'files', fileId);
      await updateDoc(docRef, updates);
      console.log('File updated:', fileId);
    } catch (error) {
      console.error('Error updating file:', error);
      throw error;
    }
  }

  /**
   * Delete file document permanently (for Firestore-only storage)
   */
  async deleteFile(fileId) {
    if (this.isDemoMode) {
      console.log('Demo Mode: Deleting file:', fileId);
      return;
    }

    try {
      const docRef = doc(this.db, 'files', fileId);
      await deleteDoc(docRef);
      console.log('File deleted:', fileId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Demo mode file retrieval (for Firestore-only storage)
   */
  getDemoFileByPath(pathOrId) {
    // Return a demo file for testing
    return {
      id: pathOrId,
      name: 'demo-file.txt',
      size: 1024,
      type: 'text/plain',
      data: 'data:text/plain;base64,SGVsbG8gZnJvbSBEcml2ZSBOZXN0IERlbW8h',
      path: pathOrId,
      uploadedBy: 'demo-user',
      created: new Date(),
      modified: new Date(),
      starred: false,
      trashed: false
    };
  }
}

// Create and export Firestore service instance
const firestoreService = new FirestoreService();

// Create alias for compatibility with storage-firestore.js
const firestoreManager = firestoreService;

// Export Firestore instance for direct access
export { db, firestoreManager };

// Export Firestore service as default
export default firestoreService;

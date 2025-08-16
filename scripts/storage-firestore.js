// Firestore-only Storage Manager for Firebase Free Tier
// Stores files < 1MB as base64 in Firestore documents

import { firestoreManager } from './firestore.js';

class FirestoreStorageManager {
    constructor() {
        this.isDemoMode = this.checkDemoMode();
        this.maxFileSize = 1024 * 1024; // 1MB limit for Firestore documents
        this.maxTotalSize = 1024 * 1024 * 1024; // 1GB total storage limit for free tier
        
        if (this.isDemoMode) {
            console.log('Firestore Storage Manager: Running in Demo Mode');
        }
    }

    checkDemoMode() {
        // Check if we're in demo mode (Firebase not properly configured)
        const demoMode = firestoreManager.isDemoMode;
        console.log('Storage Manager: Demo mode check =', demoMode);
        console.log('Storage Manager: Firestore manager isDemoMode =', firestoreManager.isDemoMode);
        return demoMode;
    }

    /**
     * Convert file to base64 for Firestore storage
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    /**
     * Check if file can be uploaded
     */
    async canUploadFile(file, userId) {
        // Check file size
        if (file.size > this.maxFileSize) {
            throw new Error(`File too large. Maximum size is ${this.formatFileSize(this.maxFileSize)} for free tier.`);
        }

        // Check total storage usage
        try {
            const usage = await this.getStorageUsage(userId);
            if (usage.used + file.size > this.maxTotalSize) {
                throw new Error(`Storage quota exceeded. Maximum storage is ${this.formatFileSize(this.maxTotalSize)}.`);
            }
        } catch (error) {
            console.warn('Could not check storage usage:', error);
        }

        return true;
    }

    /**
     * Upload file to Firestore as base64
     */
    async uploadFile(file, path, onProgress) {
        if (this.isDemoMode) {
            return this.uploadFileDemo(file, path, onProgress);
        }

        try {
            const user = window.authManager?.getCurrentUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            const userId = user.uid;

            // Check if file can be uploaded
            await this.canUploadFile(file, userId);

            // Convert to base64
            const base64Data = await this.fileToBase64(file);
            
            // Simulate progress for better UX
            if (onProgress) {
                const progressIntervals = [10, 30, 50, 70, 85, 95, 100];
                let currentProgress = 0;
                
                const progressTimer = setInterval(() => {
                    if (currentProgress < progressIntervals.length - 1) {
                        currentProgress++;
                        const progress = progressIntervals[currentProgress];
                        onProgress({ 
                            bytesTransferred: (file.size * progress) / 100,
                            totalBytes: file.size,
                            state: 'running'
                        });
                    }
                }, 100);

                // Clear timer after upload completes
                setTimeout(() => clearInterval(progressTimer), 1000);
            }

            // Create file document for Firestore
            const fileDoc = {
                id: this.generateFileId(),
                name: file.name,
                size: file.size,
                type: file.type,
                data: base64Data,
                path: path,
                uploadedBy: userId,
                ownerId: userId, // Add both for compatibility
                uploadedAt: new Date(),
                created: new Date(),
                modified: new Date(),
                starred: false,
                trashed: false,
                version: 1,
                tags: [],
                sharedWith: []
            };

            console.log('Saving file with path:', path);
            console.log('File document:', fileDoc);

            // Save to Firestore
            await firestoreManager.saveFile(fileDoc);

            // Log activity
            await firestoreManager.logActivity({
                userId,
                action: 'upload',
                fileName: file.name,
                fileSize: file.size,
                timestamp: new Date()
            });

            // Complete progress
            if (onProgress) {
                onProgress({ 
                    bytesTransferred: file.size,
                    totalBytes: file.size,
                    state: 'success'
                });
            }

            return { 
                url: base64Data,
                downloadURL: base64Data,
                path: path,
                userId: userId,
                fileName: file.name,
                ref: fileDoc.id,
                metadata: {
                    name: file.name,
                    size: file.size,
                    contentType: file.type,
                    timeCreated: fileDoc.created
                }
            };

        } catch (error) {
            console.error('Upload error:', error);
            
            if (onProgress) {
                onProgress({ 
                    bytesTransferred: 0,
                    totalBytes: file.size,
                    state: 'error',
                    error: error.message
                });
            }
            
            throw error;
        }
    }

    // Demo mode file upload simulation
    async uploadFileDemo(file, path, onProgress) {
        console.log('Demo Mode: Simulating file upload for:', file.name);
        
        // Simulate upload progress
        return new Promise((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress > 100) progress = 100;
                
                if (onProgress) {
                    onProgress({ 
                        bytesTransferred: (file.size * progress) / 100,
                        totalBytes: file.size,
                        state: 'running'
                    });
                }
                
                if (progress >= 100) {
                    clearInterval(interval);
                    const timestamp = Date.now();
                    const randomId = Math.random().toString(36).substr(2, 9);
                    const fileName = `${timestamp}_${randomId}_${file.name}`;
                    const demoURL = `demo://storage/${path}/${fileName}`;
                    
                    console.log('Demo Mode: Upload complete, returning URL:', demoURL);
                    console.log('Demo Mode: Upload path:', path);
                    resolve({
                        url: demoURL,
                        downloadURL: demoURL,
                        path: path, // Use the actual path parameter
                        userId: 'demo-user',
                        fileName: fileName,
                        ref: 'demo-ref-' + timestamp,
                        metadata: {
                            name: file.name,
                            size: file.size,
                            contentType: file.type,
                            timeCreated: new Date()
                        }
                    });
                }
            }, 200);
        });
    }

    /**
     * Get download URL (return base64 data URL)
     */
    async getDownloadURL(pathOrId) {
        console.log('getDownloadURL called with:', pathOrId);
        
        if (this.isDemoMode) {
            return this.getDownloadURLDemo(pathOrId);
        }

        try {
            console.log('Trying to get file by path/id:', pathOrId);
            const fileDoc = await firestoreManager.getFileByPath(pathOrId);
            console.log('Retrieved file document:', fileDoc);
            
            if (!fileDoc || !fileDoc.data) {
                console.error('File document missing or no data:', fileDoc);
                throw new Error('File not found or no data available');
            }
            
            return fileDoc.data; // Return base64 data URL
            
        } catch (error) {
            console.error('Get URL error:', error);
            throw new Error(`Failed to get file: ${error.message}`);
        }
    }

    // Demo mode download URL
    getDownloadURLDemo(reference) {
        const fileName = reference.split('/').pop() || 'demo-file';
        console.log('Demo Mode: Returning demo URL for:', fileName);
        
        // Return a placeholder URL based on file type
        if (fileName.endsWith('.jpg') || fileName.endsWith('.png') || fileName.endsWith('.jpeg')) {
            return `https://via.placeholder.com/400x300/4F46E5/FFFFFF?text=${encodeURIComponent(fileName)}`;
        } else if (fileName.endsWith('.pdf')) {
            return `data:application/pdf;base64,demo-pdf-content-for-${fileName}`;
        } else {
            return `demo://download/${fileName}`;
        }
    }

    /**
     * Delete file from Firestore
     */
    async deleteFile(pathOrId) {
        if (this.isDemoMode) {
            return this.deleteFileDemo(pathOrId);
        }

        try {
            const user = window.authManager?.getCurrentUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            const userId = user.uid;

            const fileDoc = await firestoreManager.getFileByPath(pathOrId);
            if (!fileDoc) {
                throw new Error('File not found');
            }

            // Check ownership
            if (fileDoc.uploadedBy !== userId) {
                throw new Error('Permission denied');
            }

            // Move to trash instead of permanent delete
            await firestoreManager.updateFile(fileDoc.id, {
                trashed: true,
                trashedAt: new Date()
            });

            // Log activity
            await firestoreManager.logActivity({
                userId,
                action: 'delete',
                fileName: fileDoc.name,
                timestamp: new Date()
            });

            console.log('File moved to trash:', fileDoc.name);
            
        } catch (error) {
            console.error('Delete error:', error);
            throw error;
        }
    }

    // Demo mode file deletion
    async deleteFileDemo(path) {
        console.log('Demo Mode: Simulating file deletion for:', path);
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('Demo Mode: File deletion complete');
    }

    /**
     * Get file metadata
     */
    async getFileMetadata(pathOrId) {
        if (this.isDemoMode) {
            return this.getFileMetadataDemo(pathOrId);
        }

        try {
            const fileDoc = await firestoreManager.getFileByPath(pathOrId);
            if (!fileDoc) {
                throw new Error('File not found');
            }
            
            return {
                name: fileDoc.name,
                size: fileDoc.size,
                contentType: fileDoc.type,
                timeCreated: fileDoc.created,
                updated: fileDoc.modified || fileDoc.created,
                version: fileDoc.version || 1,
                starred: fileDoc.starred || false,
                trashed: fileDoc.trashed || false,
                tags: fileDoc.tags || [],
                sharedWith: fileDoc.sharedWith || []
            };
            
        } catch (error) {
            console.error('Metadata error:', error);
            throw error;
        }
    }

    // Demo mode file metadata
    async getFileMetadataDemo(path) {
        console.log('Demo Mode: Getting metadata for:', path);
        
        const fileName = path.split('/').pop() || 'demo-file';
        const fileExtension = fileName.split('.').pop() || 'txt';
        
        return {
            name: fileName,
            size: Math.floor(Math.random() * 5000000), // Random size up to 5MB
            contentType: this.getMimeType(fileExtension),
            timeCreated: new Date(Date.now() - Math.floor(Math.random() * 1000000000)),
            updated: new Date(),
            downloadTokens: 'demo-token-' + Math.random().toString(36).substr(2, 9)
        };
    }

    /**
     * Get storage usage for user
     */
    async getStorageUsage(userId) {
        if (this.isDemoMode) {
            return {
                used: Math.floor(Math.random() * 500000000), // Random usage up to 500MB
                available: this.maxTotalSize - Math.floor(Math.random() * 500000000),
                fileCount: Math.floor(Math.random() * 100),
                quota: this.maxTotalSize
            };
        }

        try {
            const files = await firestoreManager.getUserFiles(userId);
            
            let totalSize = 0;
            let fileCount = 0;
            
            files.forEach(file => {
                if (!file.trashed) {
                    totalSize += file.size || 0;
                    fileCount++;
                }
            });
            
            return {
                used: totalSize,
                available: this.maxTotalSize - totalSize,
                fileCount: fileCount,
                quota: this.maxTotalSize
            };
            
        } catch (error) {
            console.error('Storage usage error:', error);
            return {
                used: 0,
                available: this.maxTotalSize,
                fileCount: 0,
                quota: this.maxTotalSize
            };
        }
    }

    /**
     * Star/unstar file
     */
    async toggleStar(pathOrId) {
        if (this.isDemoMode) {
            console.log('Demo Mode: Toggling star for file', pathOrId);
            return Math.random() > 0.5; // Random star state
        }

        try {
            const user = window.authManager?.getCurrentUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            const userId = user.uid;

            const fileDoc = await firestoreManager.getFileByPath(pathOrId);
            if (!fileDoc) {
                throw new Error('File not found');
            }

            // Check ownership or shared access
            if (fileDoc.uploadedBy !== userId && !fileDoc.sharedWith.includes(userId)) {
                throw new Error('Permission denied');
            }

            const newStarredState = !fileDoc.starred;
            
            await firestoreManager.updateFile(fileDoc.id, {
                starred: newStarredState,
                modified: new Date()
            });

            // Log activity
            await firestoreManager.logActivity({
                userId,
                action: newStarredState ? 'star' : 'unstar',
                fileName: fileDoc.name,
                timestamp: new Date()
            });

            return newStarredState;
            
        } catch (error) {
            console.error('Toggle star error:', error);
            throw error;
        }
    }

    /**
     * Generate unique file ID
     */
    generateFileId() {
        return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Get MIME type based on file extension
     */
    getMimeType(extension) {
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'flac': 'audio/flac',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'txt': 'text/plain',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'text/javascript',
            'json': 'application/json',
            'xml': 'text/xml',
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed',
            '7z': 'application/x-7z-compressed'
        };
        
        return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
    }
}

// Create and export the Firestore storage manager
const firestoreStorageManager = new FirestoreStorageManager();
export { firestoreStorageManager };
export default firestoreStorageManager;

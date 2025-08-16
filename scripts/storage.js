// Firebase Storage Manager
import { storage } from './firebase-config.js';

class StorageManager {
    constructor() {
        this.storage = storage;
        this.isDemoMode = this.checkDemoMode();
        
        if (this.isDemoMode) {
            console.log('Storage Manager: Running in Demo Mode');
        }
    }

    checkDemoMode() {
        // Check if we're in demo mode (Firebase not properly configured)
        return !this.storage || 
               this.storage.app?.options?.apiKey?.includes('demo') ||
               this.storage.app?.options?.projectId?.includes('demo');
    }

    // Upload file to Firebase Storage
    async uploadFile(file, onProgress) {
        if (this.isDemoMode) {
            return this.uploadFileDemo(file, onProgress);
        }

        try {
            // Get current user for path construction
            const user = window.authManager?.getCurrentUser();
            if (!user) {
                throw new Error('User not authenticated');
            }

            const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
            
            // Create a unique file path
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substr(2, 9);
            const fileName = `${timestamp}_${randomId}_${file.name}`;
            const filePath = `files/${user.uid}/${fileName}`;
            
            const storageRef = ref(this.storage, filePath);
            const uploadTask = uploadBytesResumable(storageRef, file);

            return new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        if (onProgress) onProgress(progress);
                    },
                    (error) => {
                        console.error('Upload error:', error);
                        reject(error);
                    },
                    async () => {
                        try {
                            const downloadURL = await getDownloadURL(storageRef);
                            resolve({
                                url: downloadURL,
                                downloadURL: downloadURL,
                                path: filePath,
                                userId: user.uid,
                                fileName: fileName
                            });
                        } catch (error) {
                            reject(error);
                        }
                    }
                );
            });
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    // Demo mode file upload simulation
    async uploadFileDemo(file, onProgress) {
        console.log('Demo Mode: Simulating file upload for:', file.name);
        
        // Get current user for demo path
        const user = window.authManager?.getCurrentUser();
        const userId = user ? user.uid : 'demo-user';
        
        // Simulate upload progress
        return new Promise((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress > 100) progress = 100;
                
                if (onProgress) onProgress(progress);
                
                if (progress >= 100) {
                    clearInterval(interval);
                    
                    // Create demo result object
                    const timestamp = Date.now();
                    const randomId = Math.random().toString(36).substr(2, 9);
                    const fileName = `${timestamp}_${randomId}_${file.name}`;
                    const filePath = `demo/files/${userId}/${fileName}`;
                    const demoURL = `demo://storage/${filePath}`;
                    
                    console.log('Demo Mode: Upload complete, returning result:', demoURL);
                    resolve({
                        url: demoURL,
                        downloadURL: demoURL,
                        path: filePath,
                        userId: userId,
                        fileName: fileName
                    });
                }
            }, 200);
        });
    }

    // Get download URL for a file
    async getDownloadURL(reference) {
        if (this.isDemoMode) {
            return this.getDownloadURLDemo(reference);
        }

        try {
            const { getDownloadURL } = await import('firebase/storage');
            return await getDownloadURL(reference);
        } catch (error) {
            console.error('Error getting download URL:', error);
            throw error;
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

    // Delete a file from storage
    async deleteFile(path) {
        if (this.isDemoMode) {
            return this.deleteFileDemo(path);
        }

        try {
            const { ref, deleteObject } = await import('firebase/storage');
            
            const fileRef = ref(this.storage, path);
            await deleteObject(fileRef);
            console.log('File deleted successfully:', path);
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    }

    // Demo mode file deletion
    async deleteFileDemo(path) {
        console.log('Demo Mode: Simulating file deletion for:', path);
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('Demo Mode: File deletion complete');
    }

    // Get file metadata
    async getFileMetadata(path) {
        if (this.isDemoMode) {
            return this.getFileMetadataDemo(path);
        }

        try {
            const { ref, getMetadata } = await import('firebase/storage');
            
            const fileRef = ref(this.storage, path);
            const metadata = await getMetadata(fileRef);
            return metadata;
        } catch (error) {
            console.error('Error getting file metadata:', error);
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
            timeCreated: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString(),
            updated: new Date().toISOString(),
            downloadTokens: 'demo-token-' + Math.random().toString(36).substr(2, 9)
        };
    }

    // Get MIME type based on file extension
    getMimeType(extension) {
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'txt': 'text/plain',
            'mp4': 'video/mp4',
            'mp3': 'audio/mpeg',
            'zip': 'application/zip',
            'js': 'application/javascript',
            'html': 'text/html',
            'css': 'text/css'
        };
        
        return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
    }
}

// Create and export storage manager instance
const storageManager = new StorageManager();
export { storageManager };
export default storageManager;

/**
 * Drive Nest - Upload Handler Module
 * Handles file uploads with drag-and-drop, progress tracking, and queue management
 */

import firestoreStorageManager from './storage-firestore.js';
import firestoreManager from './firestore.js';
import { showToast, showProgress, updateProgress, hideProgress } from './ui/modals.js';

class UploadHandler {
  constructor() {
    this.uploadQueue = [];
    this.activeUploads = new Map();
    this.maxConcurrentUploads = 3;
    this.maxFileSize = 1024 * 1024; // 1MB for free tier
    this.allowedTypes = new Set([
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
      // Videos  
      'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/wmv', 'video/flv',
      // Audio
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/m4a',
      // Documents
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/msword', // .doc
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-powerpoint', // .ppt
      // Text
      'text/plain', 'text/html', 'text/css', 'text/javascript', 'application/json', 
      'application/xml', 'text/csv', 'text/markdown',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
      // Other
      'application/octet-stream'
    ]);

    // Use Firestore storage manager
    this.storageManager = firestoreStorageManager;

    this.dropZone = null;
    this.fileInput = null;
    this.uploadButton = null;

    this.initializeEventListeners();
  }

  /**
   * Initialize upload event listeners
   */
  initializeEventListeners() {
    document.addEventListener('DOMContentLoaded', () => {
      this.setupDropZone();
      this.setupFileInput();
      this.setupUploadButton();
    });
  }

  /**
   * Setup drag-and-drop functionality
   */
  setupDropZone() {
    this.dropZone = document.getElementById('file-grid');
    if (!this.dropZone) return;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Visual feedback for drag operations
    ['dragenter', 'dragover'].forEach(eventName => {
      this.dropZone.addEventListener(eventName, () => {
        this.dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      this.dropZone.addEventListener(eventName, () => {
        this.dropZone.classList.remove('drag-over');
      });
    });

    // Handle file drop
    this.dropZone.addEventListener('drop', (e) => {
      const files = Array.from(e.dataTransfer.files);
      this.handleFileSelection(files);
    });
  }

  /**
   * Setup file input functionality
   */
  setupFileInput() {
    this.fileInput = document.getElementById('file-input');
    if (!this.fileInput) return;

    this.fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      this.handleFileSelection(files);
      // Clear input so same file can be selected again
      e.target.value = '';
    });
  }

  /**
   * Setup upload button
   */
  setupUploadButton() {
    this.uploadButton = document.getElementById('upload-btn');
    if (!this.uploadButton) return;

    this.uploadButton.addEventListener('click', () => {
      this.fileInput?.click();
    });
  }

  /**
   * Handle file selection from drag-drop or file input
   * @param {File[]} files Selected files
   */
  async handleFileSelection(files) {
    if (!files || files.length === 0) return;

    try {
      // Validate files
      const validFiles = [];
      const invalidFiles = [];

      for (const file of files) {
        const validation = this.validateFile(file);
        if (validation.valid) {
          validFiles.push(file);
        } else {
          invalidFiles.push({ file, reason: validation.reason });
        }
      }

      // Show validation errors
      if (invalidFiles.length > 0) {
        this.showValidationErrors(invalidFiles);
      }

      // Upload valid files
      if (validFiles.length > 0) {
        await this.uploadFiles(validFiles);
      }

    } catch (error) {
      console.error('Error handling file selection:', error);
      showToast('Error processing files', 'error');
    }
  }

  /**
   * Validate a single file
   * @param {File} file File to validate
   * @returns {Object} Validation result
   */
  validateFile(file) {
    // Check file size
    if (file.size > this.maxFileSize) {
      return {
        valid: false,
        reason: `File size exceeds ${this.formatFileSize(this.maxFileSize)} limit`
      };
    }

    // Check file type (allow all for now, filter on display)
    // if (!this.allowedTypes.has(file.type) && file.type !== '') {
    //   return {
    //     valid: false,
    //     reason: 'File type not supported'
    //   };
    // }

    // Check filename
    if (!file.name || file.name.trim() === '') {
      return {
        valid: false,
        reason: 'Invalid filename'
      };
    }

    return { valid: true };
  }

  /**
   * Show validation errors to user
   * @param {Array} invalidFiles Array of invalid files with reasons
   */
  showValidationErrors(invalidFiles) {
    const errorMessages = invalidFiles.map(({ file, reason }) => 
      `${file.name}: ${reason}`
    ).join('\n');

    showToast(`Upload errors:\n${errorMessages}`, 'error', 5000);
  }

  /**
   * Upload multiple files
   * @param {File[]} files Files to upload
   */
  async uploadFiles(files) {
    if (files.length === 0) return;

    // Add files to upload queue
    const uploads = files.map(file => ({
      id: this.generateUploadId(),
      file,
      status: 'queued',
      progress: 0,
      error: null,
      startTime: null,
      endTime: null
    }));

    this.uploadQueue.push(...uploads);

    // Show upload progress modal for multiple files
    if (files.length > 1) {
      this.showBatchUploadProgress(uploads);
    }

    // Process upload queue
    await this.processUploadQueue();
  }

  /**
   * Process the upload queue
   */
  async processUploadQueue() {
    while (this.uploadQueue.length > 0 && this.activeUploads.size < this.maxConcurrentUploads) {
      const upload = this.uploadQueue.shift();
      this.startUpload(upload);
    }
  }

  /**
   * Start a single upload
   * @param {Object} upload Upload object
   */
  async startUpload(upload) {
    try {
      upload.status = 'uploading';
      upload.startTime = Date.now();
      this.activeUploads.set(upload.id, upload);

      // Show individual progress for single file uploads
      if (this.activeUploads.size === 1 && this.uploadQueue.length === 0) {
        showProgress(`Uploading ${upload.file.name}...`, 0);
      }

      // Upload file to Firebase Storage
      const currentPath = window.app?.currentPath || [];
      const uploadPath = currentPath.join('/');
      
      const result = await this.storageManager.uploadFile(
        upload.file,
        uploadPath,
        (progress) => {
          upload.progress = progress;
          this.updateUploadProgress(upload);
        }
      );

      // File is already saved by storage manager, no need to save metadata again
      console.log('File uploaded and saved by storage manager:', result);

      // Mark as completed
      upload.status = 'completed';
      upload.progress = 100;
      upload.endTime = Date.now();
      upload.result = result;

      this.updateUploadProgress(upload);

      // Show success notification
      if (this.activeUploads.size === 1 && this.uploadQueue.length === 0) {
        hideProgress();
        showToast(`${upload.file.name} uploaded successfully`, 'success');
      }

      // Refresh file list
      if (window.app && typeof window.app.loadFiles === 'function') {
        window.app.loadFiles();
      }

    } catch (error) {
      console.error('Upload failed:', error);
      
      upload.status = 'failed';
      upload.error = error.message;
      upload.endTime = Date.now();

      // Show error notification
      if (this.activeUploads.size === 1 && this.uploadQueue.length === 0) {
        hideProgress();
      }
      
      showToast(`Failed to upload ${upload.file.name}: ${error.message}`, 'error');
    } finally {
      // Remove from active uploads
      this.activeUploads.delete(upload.id);

      // Process next item in queue
      if (this.uploadQueue.length > 0) {
        setTimeout(() => this.processUploadQueue(), 100);
      } else if (this.activeUploads.size === 0) {
        // All uploads completed
        this.onAllUploadsComplete();
      }
    }
  }

  /**
   * Update upload progress
   * @param {Object} upload Upload object
   */
  updateUploadProgress(upload) {
    // Update individual progress for single uploads
    if (this.activeUploads.size === 1 && this.uploadQueue.length === 0) {
      updateProgress(upload.progress);
    }

    // Update batch progress modal if it exists
    this.updateBatchProgress();

    // Trigger custom event for progress updates
    document.dispatchEvent(new CustomEvent('uploadProgress', {
      detail: { upload, activeUploads: this.activeUploads }
    }));
  }

  /**
   * Show batch upload progress modal
   * @param {Array} uploads Array of upload objects
   */
  showBatchUploadProgress(uploads) {
    const progressContent = `
      <div class="batch-upload-progress">
        <h3>Uploading ${uploads.length} files</h3>
        <div class="upload-list">
          ${uploads.map(upload => `
            <div class="upload-item" data-upload-id="${upload.id}">
              <div class="upload-file-info">
                <span class="file-name">${upload.file.name}</span>
                <span class="file-size">(${this.formatFileSize(upload.file.size)})</span>
              </div>
              <div class="upload-progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
              </div>
              <div class="upload-status">Queued</div>
            </div>
          `).join('')}
        </div>
        <div class="batch-progress-summary">
          <div class="overall-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: 0%"></div>
            </div>
            <span class="progress-text">0% complete</span>
          </div>
        </div>
      </div>
    `;

    showProgress(progressContent, 0, false);
  }

  /**
   * Update batch progress display
   */
  updateBatchProgress() {
    const batchProgress = document.querySelector('.batch-upload-progress');
    if (!batchProgress) return;

    // Update individual upload items
    for (const upload of this.activeUploads.values()) {
      const uploadItem = batchProgress.querySelector(`[data-upload-id="${upload.id}"]`);
      if (uploadItem) {
        const progressFill = uploadItem.querySelector('.progress-fill');
        const statusElement = uploadItem.querySelector('.upload-status');
        
        if (progressFill) {
          progressFill.style.width = `${upload.progress}%`;
        }
        
        if (statusElement) {
          statusElement.textContent = this.getStatusText(upload.status, upload.progress);
          statusElement.className = `upload-status ${upload.status}`;
        }
      }
    }

    // Update overall progress
    const overallProgress = this.calculateOverallProgress();
    const overallProgressBar = batchProgress.querySelector('.batch-progress-summary .progress-fill');
    const overallProgressText = batchProgress.querySelector('.progress-text');

    if (overallProgressBar) {
      overallProgressBar.style.width = `${overallProgress}%`;
    }
    
    if (overallProgressText) {
      overallProgressText.textContent = `${Math.round(overallProgress)}% complete`;
    }
  }

  /**
   * Calculate overall progress percentage
   * @returns {number} Overall progress percentage
   */
  calculateOverallProgress() {
    if (this.activeUploads.size === 0) return 100;

    const totalProgress = Array.from(this.activeUploads.values())
      .reduce((sum, upload) => sum + upload.progress, 0);
    
    return totalProgress / this.activeUploads.size;
  }

  /**
   * Get status text for upload
   * @param {string} status Upload status
   * @param {number} progress Progress percentage
   * @returns {string} Status text
   */
  getStatusText(status, progress) {
    switch (status) {
      case 'queued': return 'Queued';
      case 'uploading': return `${Math.round(progress)}%`;
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  }

  /**
   * Called when all uploads are complete
   */
  onAllUploadsComplete() {
    hideProgress();
    
    const completedCount = Array.from(this.activeUploads.values())
      .filter(upload => upload.status === 'completed').length;
    
    if (completedCount > 1) {
      showToast(`${completedCount} files uploaded successfully`, 'success');
    }

    // Clear upload history (keep for debugging in dev mode)
    // Only clear in production environment
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      this.clearUploadHistory();
    }
  }

  /**
   * Clear upload history
   */
  clearUploadHistory() {
    this.uploadQueue = [];
    this.activeUploads.clear();
  }

  /**
   * Generate unique upload ID
   * @returns {string} Upload ID
   */
  generateUploadId() {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format file size
   * @param {number} bytes File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
  }

  /**
   * Cancel active uploads
   */
  cancelAllUploads() {
    for (const upload of this.activeUploads.values()) {
      if (upload.status === 'uploading' && upload.cancelFunction) {
        upload.cancelFunction();
      }
    }
    
    this.clearUploadHistory();
    hideProgress();
    showToast('Uploads cancelled', 'info');
  }

  /**
   * Get upload statistics
   * @returns {Object} Upload statistics
   */
  getUploadStats() {
    const uploads = Array.from(this.activeUploads.values());
    
    return {
      total: uploads.length,
      completed: uploads.filter(u => u.status === 'completed').length,
      failed: uploads.filter(u => u.status === 'failed').length,
      active: uploads.filter(u => u.status === 'uploading').length,
      queued: this.uploadQueue.length
    };
  }

  /**
   * Check if uploads are in progress
   * @returns {boolean} True if uploads are active
   */
  hasActiveUploads() {
    return this.activeUploads.size > 0 || this.uploadQueue.length > 0;
  }
}

// Create and export upload handler instance
const uploadHandler = new UploadHandler();

export default uploadHandler;

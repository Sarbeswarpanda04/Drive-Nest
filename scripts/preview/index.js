/**
 * Drive Nest - File Preview Router
 * Coordinates different file type preview modules
 */

import pdfPreviewManager from './pdf.js';
import docxPreviewManager from './docx.js';

class FilePreviewRouter {
  constructor() {
    this.previewManagers = new Map();
    this.currentPreview = null;
    this.supportedTypes = new Map();
    
    this.initializePreviewManagers();
  }

  /**
   * Initialize preview managers for different file types
   */
  initializePreviewManagers() {
    // PDF files
    this.previewManagers.set('pdf', pdfPreviewManager);
    this.supportedTypes.set('pdf', {
      mimeTypes: ['application/pdf'],
      extensions: ['.pdf'],
      name: 'PDF Document',
      icon: '📄'
    });

    // DOCX files
    this.previewManagers.set('docx', docxPreviewManager);
    this.supportedTypes.set('docx', {
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      extensions: ['.docx'],
      name: 'Word Document',
      icon: '📝'
    });

    // Images
    this.previewManagers.set('image', new ImagePreviewManager());
    this.supportedTypes.set('image', {
      mimeTypes: [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
        'image/webp', 'image/svg+xml', 'image/bmp'
      ],
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
      name: 'Image',
      icon: '🖼️'
    });

    // Videos
    this.previewManagers.set('video', new VideoPreviewManager());
    this.supportedTypes.set('video', {
      mimeTypes: [
        'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 
        'video/mov', 'video/wmv', 'video/flv'
      ],
      extensions: ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv', '.flv'],
      name: 'Video',
      icon: '🎬'
    });

    // Audio
    this.previewManagers.set('audio', new AudioPreviewManager());
    this.supportedTypes.set('audio', {
      mimeTypes: [
        'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 
        'audio/flac', 'audio/m4a'
      ],
      extensions: ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'],
      name: 'Audio',
      icon: '🎵'
    });

    // Text files
    this.previewManagers.set('text', new TextPreviewManager());
    this.supportedTypes.set('text', {
      mimeTypes: [
        'text/plain', 'text/html', 'text/css', 'text/javascript',
        'application/json', 'application/xml', 'text/csv',
        'text/markdown'
      ],
      extensions: [
        '.txt', '.html', '.htm', '.css', '.js', '.json', '.xml', 
        '.csv', '.md', '.readme', '.log'
      ],
      name: 'Text Document',
      icon: '📝'
    });
  }

  /**
   * Determine file type from file object
   * @param {Object} file File object with name and mimeType
   * @returns {string|null} File type or null if unsupported
   */
  getFileType(file) {
    const fileName = file.name.toLowerCase();
    const mimeType = file.mimeType?.toLowerCase() || '';

    // Check by MIME type first
    for (const [type, config] of this.supportedTypes) {
      if (config.mimeTypes.includes(mimeType)) {
        return type;
      }
    }

    // Check by file extension
    for (const [type, config] of this.supportedTypes) {
      if (config.extensions.some(ext => fileName.endsWith(ext))) {
        return type;
      }
    }

    return null;
  }

  /**
   * Check if file type is supported for preview
   * @param {Object} file File object
   * @returns {boolean} True if supported
   */
  isPreviewSupported(file) {
    return this.getFileType(file) !== null;
  }

  /**
   * Get preview info for a file
   * @param {Object} file File object
   * @returns {Object|null} Preview info or null
   */
  getPreviewInfo(file) {
    const type = this.getFileType(file);
    if (!type) return null;

    const config = this.supportedTypes.get(type);
    return {
      type,
      ...config,
      canPreview: true
    };
  }

  /**
   * Create file preview
   * @param {Object} file File object
   * @param {string} url File URL
   * @param {Element} container Container element
   * @param {Object} options Preview options
   * @returns {Promise<Object>} Preview controller
   */
  async createPreview(file, url, container, options = {}) {
    try {
      // Clear any existing preview
      if (this.currentPreview) {
        this.destroyCurrentPreview();
      }

      const fileType = this.getFileType(file);
      if (!fileType) {
        return this.createUnsupportedPreview(file, url, container);
      }

      const previewManager = this.previewManagers.get(fileType);
      if (!previewManager) {
        throw new Error(`No preview manager for type: ${fileType}`);
      }

      // Show loading state
      this.showLoadingState(container, file);

      // Create the preview
      const preview = await previewManager.createPreview(url, container, {
        file,
        fileType,
        ...options
      });

      this.currentPreview = preview;
      
      // Add metadata to preview
      if (preview && typeof preview === 'object') {
        preview.file = file;
        preview.fileType = fileType;
        preview.url = url;
      }

      return preview;

    } catch (error) {
      console.error('Error creating preview:', error);
      return this.createErrorPreview(file, url, container, error);
    }
  }

  /**
   * Show loading state
   * @param {Element} container Container element
   * @param {Object} file File object
   */
  showLoadingState(container, file) {
    const previewInfo = this.getPreviewInfo(file);
    
    container.innerHTML = `
      <div class="preview-loading">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-text">
            <div class="file-icon">${previewInfo?.icon || '📄'}</div>
            <div class="file-name">${file.name}</div>
            <div class="loading-message">Loading preview...</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create unsupported file type preview
   * @param {Object} file File object
   * @param {string} url File URL
   * @param {Element} container Container element
   * @returns {Object} Preview controller
   */
  createUnsupportedPreview(file, url, container) {
    const fileExt = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    const fileSize = this.formatFileSize(file.size);

    container.innerHTML = `
      <div class="preview-unsupported">
        <div class="unsupported-content">
          <div class="file-icon-large">
            ${this.getGenericFileIcon(file.name)}
          </div>
          <h3>${file.name}</h3>
          <div class="file-details">
            <span class="file-type">${fileExt} File</span>
            <span class="file-size">${fileSize}</span>
          </div>
          <p>This file type cannot be previewed online.</p>
          <div class="preview-actions">
            <button class="btn btn-primary download-btn">
              ⬇ Download File
            </button>
          </div>
        </div>
      </div>
    `;

    // Setup download button
    const downloadBtn = container.querySelector('.download-btn');
    downloadBtn.addEventListener('click', () => {
      this.downloadFile(url, file.name);
    });

    return {
      file,
      url,
      container,
      destroy: () => {
        container.innerHTML = '';
      }
    };
  }

  /**
   * Create error preview
   * @param {Object} file File object
   * @param {string} url File URL
   * @param {Element} container Container element
   * @param {Error} error Error object
   * @returns {Object} Preview controller
   */
  createErrorPreview(file, url, container, error) {
    container.innerHTML = `
      <div class="preview-error">
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <h3>Preview Error</h3>
          <p>Failed to load preview for <strong>${file.name}</strong></p>
          <div class="error-details">
            <small>${error.message}</small>
          </div>
          <div class="error-actions">
            <button class="btn btn-secondary retry-btn">
              🔄 Retry
            </button>
            <button class="btn btn-primary download-btn">
              ⬇ Download File
            </button>
          </div>
        </div>
      </div>
    `;

    // Setup action buttons
    const retryBtn = container.querySelector('.retry-btn');
    const downloadBtn = container.querySelector('.download-btn');

    retryBtn.addEventListener('click', () => {
      this.createPreview(file, url, container);
    });

    downloadBtn.addEventListener('click', () => {
      this.downloadFile(url, file.name);
    });

    return {
      file,
      url,
      container,
      error,
      destroy: () => {
        container.innerHTML = '';
      }
    };
  }

  /**
   * Destroy current preview
   */
  destroyCurrentPreview() {
    if (this.currentPreview && typeof this.currentPreview.destroy === 'function') {
      this.currentPreview.destroy();
    }
    this.currentPreview = null;
  }

  /**
   * Get generic file icon based on extension
   * @param {string} fileName File name
   * @returns {string} Icon emoji
   */
  getGenericFileIcon(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    
    const iconMap = {
      // Documents
      'doc': '📝', 'docx': '📝', 'odt': '📝',
      'xls': '📊', 'xlsx': '📊', 'ods': '📊',
      'ppt': '📽️', 'pptx': '📽️', 'odp': '📽️',
      'pdf': '📄',
      
      // Archives
      'zip': '🗜️', 'rar': '🗜️', '7z': '🗜️', 'tar': '🗜️',
      
      // Code
      'js': '💻', 'html': '🌐', 'css': '🎨', 'json': '📋',
      'py': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
      
      // Default
      'exe': '⚙️', 'app': '📱', 'dmg': '💿'
    };
    
    return iconMap[ext] || '📄';
  }

  /**
   * Format file size
   * @param {number} bytes File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (!bytes) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  }

  /**
   * Download file
   * @param {string} url File URL
   * @param {string} fileName File name
   */
  downloadFile(url, fileName) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Get all supported file types
   * @returns {Array} Array of supported types info
   */
  getSupportedTypes() {
    const types = [];
    for (const [type, config] of this.supportedTypes) {
      types.push({
        type,
        ...config
      });
    }
    return types;
  }
}

/**
 * Image Preview Manager
 */
class ImagePreviewManager {
  async createPreview(url, container, options = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      container.innerHTML = `
        <div class="image-preview-loading">
          <div class="loading-spinner"></div>
          <div>Loading image...</div>
        </div>
      `;

      img.onload = () => {
        const viewer = this.createImageViewer(container, url, img, options);
        resolve(viewer);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  createImageViewer(container, url, img, options) {
    const viewerHTML = `
      <div class="image-viewer">
        <div class="image-toolbar">
          <div class="image-controls">
            <button class="btn btn-secondary zoom-out" title="Zoom out">−</button>
            <span class="zoom-level">100%</span>
            <button class="btn btn-secondary zoom-in" title="Zoom in">+</button>
            <button class="btn btn-secondary fit-btn" title="Fit to screen">Fit</button>
            <button class="btn btn-secondary rotate-btn" title="Rotate">🔄</button>
          </div>
          <div class="image-info">
            <span>${img.naturalWidth} × ${img.naturalHeight}</span>
          </div>
        </div>
        <div class="image-container">
          <img src="${url}" alt="${options.file?.name || 'Preview'}" class="preview-image">
        </div>
      </div>
    `;

    container.innerHTML = viewerHTML;

    const viewer = {
      container: container.querySelector('.image-viewer'),
      image: container.querySelector('.preview-image'),
      scale: 1,
      rotation: 0
    };

    this.setupImageControls(viewer);
    
    return {
      viewer,
      destroy: () => container.innerHTML = ''
    };
  }

  setupImageControls(viewer) {
    const zoomOut = viewer.container.querySelector('.zoom-out');
    const zoomIn = viewer.container.querySelector('.zoom-in');
    const fitBtn = viewer.container.querySelector('.fit-btn');
    const rotateBtn = viewer.container.querySelector('.rotate-btn');
    const zoomLevel = viewer.container.querySelector('.zoom-level');

    const updateTransform = () => {
      viewer.image.style.transform = `scale(${viewer.scale}) rotate(${viewer.rotation}deg)`;
      zoomLevel.textContent = `${Math.round(viewer.scale * 100)}%`;
    };

    zoomOut.addEventListener('click', () => {
      viewer.scale = Math.max(0.1, viewer.scale * 0.8);
      updateTransform();
    });

    zoomIn.addEventListener('click', () => {
      viewer.scale = Math.min(5, viewer.scale * 1.2);
      updateTransform();
    });

    fitBtn.addEventListener('click', () => {
      viewer.scale = 1;
      viewer.rotation = 0;
      updateTransform();
    });

    rotateBtn.addEventListener('click', () => {
      viewer.rotation = (viewer.rotation + 90) % 360;
      updateTransform();
    });
  }
}

/**
 * Video Preview Manager
 */
class VideoPreviewManager {
  async createPreview(url, container, options = {}) {
    const viewerHTML = `
      <div class="video-viewer">
        <video 
          src="${url}" 
          controls 
          preload="metadata"
          class="preview-video">
          Your browser does not support the video tag.
        </video>
        <div class="video-info">
          <span class="file-name">${options.file?.name || 'Video'}</span>
        </div>
      </div>
    `;

    container.innerHTML = viewerHTML;

    return {
      destroy: () => {
        const video = container.querySelector('video');
        if (video) {
          video.pause();
          video.src = '';
        }
        container.innerHTML = '';
      }
    };
  }
}

/**
 * Audio Preview Manager
 */
class AudioPreviewManager {
  async createPreview(url, container, options = {}) {
    const viewerHTML = `
      <div class="audio-viewer">
        <div class="audio-player">
          <div class="audio-icon">🎵</div>
          <div class="audio-info">
            <div class="file-name">${options.file?.name || 'Audio'}</div>
            <audio 
              src="${url}" 
              controls 
              preload="metadata"
              class="preview-audio">
              Your browser does not support the audio tag.
            </audio>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = viewerHTML;

    return {
      destroy: () => {
        const audio = container.querySelector('audio');
        if (audio) {
          audio.pause();
          audio.src = '';
        }
        container.innerHTML = '';
      }
    };
  }
}

/**
 * Text Preview Manager
 */
class TextPreviewManager {
  async createPreview(url, container, options = {}) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch text content');
      
      const text = await response.text();
      const fileName = options.file?.name || 'text';
      const isCode = this.isCodeFile(fileName);

      const viewerHTML = `
        <div class="text-viewer">
          <div class="text-toolbar">
            <div class="text-info">
              <span class="file-name">${fileName}</span>
              <span class="line-count">${text.split('\n').length} lines</span>
            </div>
          </div>
          <div class="text-content">
            <pre class="${isCode ? 'code-content' : 'text-content'}">${this.escapeHtml(text)}</pre>
          </div>
        </div>
      `;

      container.innerHTML = viewerHTML;

      return {
        destroy: () => container.innerHTML = ''
      };

    } catch (error) {
      throw new Error(`Failed to load text content: ${error.message}`);
    }
  }

  isCodeFile(fileName) {
    const codeExtensions = ['.js', '.css', '.html', '.json', '.xml', '.py', '.java', '.cpp', '.c'];
    return codeExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create and export file preview router instance
const filePreviewRouter = new FilePreviewRouter();

export default filePreviewRouter;

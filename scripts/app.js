/**
 * Drive Nest - Main Application Module
 * Handles app initialization, routing, and core functionality
 */

import authManager from './auth.js';
import firestoreStorageManager from './storage-firestore.js';
import firestoreManager from './firestore.js';
import uploadHandler from './upload.js';
import filePreviewRouter from './preview/index.js';
import { showModal, hideModal, showToast } from './ui/modals.js';
import { setupKeyboardShortcuts } from './ui/keyboard.js';

class DriveNestApp {
  constructor() {
    this.currentView = 'my-files';
    this.currentPath = [];
    this.selectedFiles = new Set();
    this.viewMode = localStorage.getItem('viewMode') || 'grid';
    this.theme = localStorage.getItem('theme') || 'system';
    this.user = null;
    this.files = [];
    this.filteredFiles = [];
    this.searchDebounceTimer = null;
    this.currentPreviewController = null;
    
    // Use Firestore storage manager instead of Firebase Storage
    this.storageManager = firestoreStorageManager;
    this.authManager = authManager;
    this.firestoreManager = firestoreManager;
    
    // Expose app instance globally for upload handler and other modules
    window.app = this;
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      // Show loading screen
      this.showLoadingScreen();
      
      // Setup theme
      this.setupTheme();
      
      // Setup keyboard shortcuts
      setupKeyboardShortcuts(this);
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Setup upload functionality
      this.setupUploadModal();
      
      // Initialize Firebase and check auth state
      await this.initializeAuth();
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      showToast('Failed to initialize application', 'error');
      this.hideLoadingScreen();
    }
  }

  /**
   * Show loading screen
   */
  showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('dashboard');
    
    loadingScreen.classList.remove('hidden');
    authGate.classList.add('hidden');
    dashboard.classList.add('hidden');
  }

  /**
   * Hide loading screen
   */
  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.add('hidden');
  }

  /**
   * Show authentication gate
   */
  showAuthGate() {
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('dashboard');
    
    authGate.classList.remove('hidden');
    dashboard.classList.add('hidden');
    this.hideLoadingScreen();
  }

  /**
   * Show main dashboard
   */
  showDashboard() {
    const authGate = document.getElementById('auth-gate');
    const dashboard = document.getElementById('dashboard');
    
    authGate.classList.add('hidden');
    dashboard.classList.remove('hidden');
    this.hideLoadingScreen();
  }

  /**
   * Setup theme system
   */
  setupTheme() {
    document.body.setAttribute('data-theme', this.theme);
    this.updateThemeIcon();
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (this.theme === 'system') {
        this.updateThemeIcon();
      }
    });
  }

  /**
   * Update theme icon based on current theme
   */
  updateThemeIcon() {
    const themeIcon = document.querySelector('.theme-icon');
    if (!themeIcon) return;
    
    let icon = '';
    if (this.theme === 'light') {
      icon = '☀️';
    } else if (this.theme === 'dark') {
      icon = '🌙';
    } else {
      // System theme - detect actual preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      icon = prefersDark ? '🌙' : '💻';
    }
    
    themeIcon.textContent = icon;
  }

  /**
   * Initialize authentication
   */
  async initializeAuth() {
    authManager.onAuthStateChanged((user) => {
      if (user) {
        this.user = user;
        this.onUserSignedIn(user);
      } else {
        this.user = null;
        this.onUserSignedOut();
      }
    });
  }

  /**
   * Handle user sign in
   */
  async onUserSignedIn(user) {
    try {
      console.log('User signed in:', user.email);
      
      // Update UI with user info
      this.updateUserInfo(user);
      
      // Load user's files
      await this.loadFiles();
      
      // Show dashboard
      this.showDashboard();
      
      // Update storage info
      await this.updateStorageInfo();
      
      showToast(`Welcome back, ${user.displayName || user.email}!`, 'success');
      
    } catch (error) {
      console.error('Error handling user sign in:', error);
      showToast('Error loading user data', 'error');
    }
  }

  /**
   * Handle user sign out
   */
  onUserSignedOut() {
    console.log('User signed out');
    this.user = null;
    this.files = [];
    this.filteredFiles = [];
    this.selectedFiles.clear();
    this.showAuthGate();
  }

  /**
   * Update user info in UI
   */
  updateUserInfo(user) {
    // Update avatar
    const avatarImg = document.getElementById('user-avatar-img');
    const settingsAvatar = document.getElementById('settings-avatar');
    
    if (avatarImg) {
      avatarImg.src = user.photoURL || '/assets/icons/default-avatar.svg';
      avatarImg.alt = user.displayName || 'User Avatar';
    }
    
    if (settingsAvatar) {
      settingsAvatar.src = user.photoURL || '/assets/icons/default-avatar.svg';
    }
    
    // Update name and email
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const settingsName = document.getElementById('settings-name');
    const settingsEmail = document.getElementById('settings-email');
    
    if (userName) userName.textContent = user.displayName || 'User';
    if (userEmail) userEmail.textContent = user.email;
    if (settingsName) settingsName.textContent = user.displayName || 'User';
    if (settingsEmail) settingsEmail.textContent = user.email;
  }

  /**
   * Load files for current view
   */
  async loadFiles() {
    try {
      const user = authManager.getCurrentUser();
      if (!user) {
        console.log('No user logged in, cannot load files');
        this.files = [];
        this.filteredFiles = [];
        this.renderFiles();
        return;
      }
      
      switch (this.currentView) {
        case 'my-files':
          this.files = await firestoreManager.getUserFiles(user.uid, this.currentPath);
          break;
        case 'shared':
          this.files = await firestoreManager.getSharedFiles(user.uid);
          break;
        case 'starred':
          this.files = await firestoreManager.getStarredFiles(user.uid);
          break;
        case 'recent':
          this.files = await firestoreManager.getRecentFiles(user.uid);
          break;
        case 'trash':
          this.files = await firestoreManager.getTrashedFiles(user.uid);
          break;
        default:
          this.files = [];
      }
      
      this.filteredFiles = [...this.files];
      this.renderFiles();
      this.updateViewTitle();
      this.updateBreadcrumb();
      
    } catch (error) {
      console.error('Error getting user files:', error);
      this.files = [];
      this.filteredFiles = [];
      this.renderFiles();
      
      if (error.code === 'permission-denied') {
        showToast('Please check Firestore security rules', 'error');
      } else {
        showToast('Error loading files: ' + error.message, 'error');
      }
      this.files = [];
      this.filteredFiles = [];
      this.renderFiles();
    }
  }

  /**
   * Render files in the grid/list
   */
  renderFiles() {
    const fileGrid = document.getElementById('file-grid');
    const emptyState = document.getElementById('empty-state');
    
    if (this.filteredFiles.length === 0) {
      fileGrid.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    
    emptyState.classList.add('hidden');
    fileGrid.className = `file-grid ${this.viewMode === 'list' ? 'list-view' : ''}`;
    
    fileGrid.innerHTML = this.filteredFiles.map(file => this.renderFileItem(file)).join('');
    
    // Add event listeners
    fileGrid.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', (e) => this.handleFileClick(e, item.dataset.fileId));
      item.addEventListener('dblclick', (e) => this.handleFileDoubleClick(e, item.dataset.fileId));
    });
  }

  /**
   * Render a single file item
   */
  renderFileItem(file) {
    const isSelected = this.selectedFiles.has(file.id);
    const fileType = file.type || file.mimeType || '';
    const icon = this.getFileIcon(fileType);
    const size = this.formatFileSize(file.size);
    const date = this.formatDate(file.modified || file.created);
    
    return `
      <div class="file-item ${isSelected ? 'selected' : ''}" data-file-id="${file.id}">
        <div class="file-icon">${icon}</div>
        ${this.viewMode === 'list' ? `
          <div class="file-info">
            <div class="file-name">${this.escapeHtml(file.name)}</div>
            <div class="file-meta">
              <span class="file-size">${size}</span>
              <span class="file-date">${date}</span>
            </div>
          </div>
        ` : `
          <div class="file-name">${this.escapeHtml(file.name)}</div>
          <div class="file-meta">
            <span class="file-size">${size}</span>
            <span class="file-date">${date}</span>
          </div>
        `}
      </div>
    `;
  }

  /**
   * Get file icon based on file type
   */
  getFileIcon(type) {
    if (!type || typeof type !== 'string') return '📄';
    
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type === 'application/pdf') return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation')) return '📊';
    if (type.startsWith('text/')) return '📄';
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return '📦';
    return '📄';
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Format date for display
   */
  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    
    return date.toLocaleDateString();
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Handle file click
   */
  handleFileClick(e, fileId) {
    if (e.ctrlKey || e.metaKey) {
      // Multi-select
      if (this.selectedFiles.has(fileId)) {
        this.selectedFiles.delete(fileId);
      } else {
        this.selectedFiles.add(fileId);
      }
    } else {
      // Single select
      this.selectedFiles.clear();
      this.selectedFiles.add(fileId);
    }
    
    this.renderFiles();
  }

  /**
   * Handle file double click (open preview)
   */
  handleFileDoubleClick(e, fileId) {
    e.preventDefault();
    this.openFilePreview(fileId);
  }

  /**
   * Open file preview modal
   */
  async openFilePreview(fileId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;
    
    // Store the current preview file ID
    this.currentPreviewFileId = fileId;
    
    try {
      const previewModal = document.getElementById('preview-modal');
      const previewContent = document.getElementById('preview-content');
      const filename = document.getElementById('preview-filename');
      
      // Clean up previous preview
      this.cleanupPreview();
      
      // Update modal title
      filename.textContent = file.name;
      
      // Update file info
      this.updatePreviewInfo(file);
      
      // Generate preview content
      previewContent.innerHTML = await this.generatePreviewContent(file);
      
      // Show modal
      showModal('preview-modal');
      
      // Setup modal close cleanup
      const closeHandler = () => {
        this.cleanupPreview();
        previewModal.removeEventListener('modal:close', closeHandler);
      };
      previewModal.addEventListener('modal:close', closeHandler);
      
    } catch (error) {
      console.error('Error opening preview:', error);
      showToast('Error opening file preview', 'error');
    }
  }

  /**
   * Cleanup preview resources
   */
  cleanupPreview() {
    if (this.currentPreviewController && typeof this.currentPreviewController.destroy === 'function') {
      this.currentPreviewController.destroy();
      this.currentPreviewController = null;
    }
  }

  /**
   * Get the current file ID being previewed
   */
  getCurrentPreviewFileId() {
    return this.currentPreviewFileId;
  }

  /**
   * Update preview modal file info
   */
  updatePreviewInfo(file) {
    document.getElementById('info-size').textContent = this.formatFileSize(file.size);
    document.getElementById('info-type').textContent = file.type;
    document.getElementById('info-created').textContent = this.formatDate(file.created);
    document.getElementById('info-modified').textContent = this.formatDate(file.modified || file.created);
    document.getElementById('info-owner').textContent = file.ownerEmail || this.user.email;
  }

  /**
   * Generate preview content based on file type
   */
  async generatePreviewContent(file) {
    try {
      console.log('Generating preview for file:', file);
      const url = await firestoreStorageManager.getDownloadURL(file.id);
      console.log('Got download URL:', url);
    
      // Create a temporary container element
      const tempContainer = document.createElement('div');
      tempContainer.style.width = '100%';
      tempContainer.style.height = '100%';
      
      try {
        // Use the file preview router to create the preview
        const fileObj = {
          name: file.name,
          mimeType: file.type,
          size: file.size
        };
        
        const preview = await filePreviewRouter.createPreview(fileObj, url, tempContainer);
        
        // Store the preview controller for cleanup later
        this.currentPreviewController = preview;
        
        return tempContainer.outerHTML;
        
      } catch (error) {
        console.error('Error creating preview:', error);
        
        // Fallback to basic preview
        return `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <div style="font-size: 4rem; margin-bottom: 1rem;">${this.getFileIcon(file.type)}</div>
          <h3>Preview not available</h3>
          <p>Unable to preview this file: ${error.message}</p>
          <button class="btn btn-primary" onclick="app.downloadFile('${file.id}')">Download File</button>
        </div>`;
      }
    } catch (error) {
      console.error('Error getting download URL:', error);
      return `<div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <div style="font-size: 4rem; margin-bottom: 1rem;">${this.getFileIcon(file.type)}</div>
        <h3>Preview not available</h3>
        <p>Unable to load file: ${error.message}</p>
        <button class="btn btn-primary" onclick="app.downloadFile('${file.id}')">Download File</button>
      </div>`;
    }
  }

  /**
   * Detect programming language for syntax highlighting
   */
  detectLanguage(filename, type) {
    const ext = filename.split('.').pop().toLowerCase();
    const langMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'xml': 'xml',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml'
    };
    return langMap[ext] || 'plaintext';
  }

  /**
   * Load PDF.js library dynamically
   */
  async loadPDFJS() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Download file
   */
  async downloadFile(fileId) {
    const file = this.files.find(f => f.id === fileId);
    if (!file) return;
    
    try {
      const url = await this.storageManager.getDownloadURL(file.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      showToast(`Downloading ${file.name}`, 'info');
      
    } catch (error) {
      console.error('Error downloading file:', error);
      showToast('Error downloading file', 'error');
    }
  }

  /**
   * Update storage information
   */
  async updateStorageInfo() {
    try {
      const user = authManager.getCurrentUser();
      if (!user) {
        console.log('No user logged in, skipping storage info update');
        return;
      }
      
      const usage = await this.storageManager.getStorageUsage(user.uid);
      const quota = 1024 * 1024 * 1024; // 1GB for free tier
      const percentage = Math.min((usage.used / quota) * 100, 100);
      
      // Update storage bars
      document.querySelectorAll('.storage-used').forEach(bar => {
        bar.style.width = `${percentage}%`;
      });
      
      // Update storage text
      document.querySelectorAll('#storage-used, #settings-storage-used').forEach(el => {
        el.textContent = this.formatFileSize(usage.used);
      });

      // Update storage percentage
      document.querySelectorAll('#storage-percentage').forEach(el => {
        el.textContent = `${Math.round(percentage)}%`;
      });

      // Update total storage displays
      document.querySelectorAll('#storage-total, #settings-storage-total').forEach(el => {
        el.textContent = this.formatFileSize(quota);
      });
      
    } catch (error) {
      console.error('Storage usage error:', error);
      // Set default values on error
      document.querySelectorAll('.storage-used').forEach(bar => {
        bar.style.width = '0%';
      });
      document.querySelectorAll('#storage-used, #settings-storage-used').forEach(el => {
        el.textContent = '0 MB';
      });
      document.querySelectorAll('#storage-percentage').forEach(el => {
        el.textContent = '0%';
      });
    }
  }

  /**
   * Update view title
   */
  updateViewTitle() {
    const viewTitle = document.getElementById('view-title');
    const titles = {
      'my-files': 'My Files',
      'shared': 'Shared with me',
      'starred': 'Starred',
      'recent': 'Recent',
      'trash': 'Trash'
    };
    
    viewTitle.textContent = titles[this.currentView] || 'My Files';
  }

  /**
   * Update breadcrumb navigation
   */
  updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');
    let html = `<span class="breadcrumb-item">${this.getViewTitle()}</span>`;
    
    if (this.currentPath.length > 0) {
      this.currentPath.forEach((folder, index) => {
        html += `<span class="breadcrumb-item">${this.escapeHtml(folder)}</span>`;
      });
    }
    
    breadcrumb.innerHTML = html;
  }

  /**
   * Get view title for breadcrumb
   */
  getViewTitle() {
    const titles = {
      'my-files': 'My Files',
      'shared': 'Shared with me',
      'starred': 'Starred',
      'recent': 'Recent',
      'trash': 'Trash'
    };
    
    return titles[this.currentView] || 'My Files';
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Auth
    document.getElementById('google-signin-btn')?.addEventListener('click', () => {
      authManager.signInWithGoogle();
    });
    
    document.getElementById('signout-btn')?.addEventListener('click', () => {
      authManager.signOut();
    });
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchView(link.dataset.view);
      });
    });
    
    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      this.toggleTheme();
    });
    
    // View toggle
    document.getElementById('view-toggle')?.addEventListener('click', () => {
      this.toggleViewMode();
    });
    
    // Search
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', (e) => {
      this.handleSearch(e.target.value);
    });
    
    // Filters
    document.getElementById('type-filter')?.addEventListener('change', (e) => {
      this.handleFilter();
    });
    
    document.getElementById('sort-by')?.addEventListener('change', (e) => {
      this.handleSort(e.target.value);
    });
    
    // Upload
    document.getElementById('upload-fab')?.addEventListener('click', () => {
      showModal('upload-modal');
    });
    
    document.getElementById('empty-upload-btn')?.addEventListener('click', () => {
      showModal('upload-modal');
    });
    
    document.getElementById('header-upload-btn')?.addEventListener('click', () => {
      showModal('upload-modal');
    });
    
    document.getElementById('empty-folder-btn')?.addEventListener('click', () => {
      this.createNewFolder();
    });
    
    document.getElementById('new-folder-btn')?.addEventListener('click', () => {
      this.createNewFolder();
    });
    
    // User menu
    document.getElementById('user-menu-btn')?.addEventListener('click', () => {
      const dropdown = document.getElementById('user-dropdown');
      dropdown.classList.toggle('hidden');
    });
    
    // Settings
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      document.getElementById('user-dropdown').classList.add('hidden');
      showModal('settings-modal');
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = btn.closest('.modal');
        hideModal(modal.id);
      });
    });

    // Preview modal buttons
    document.getElementById('download-btn')?.addEventListener('click', () => {
      const fileId = this.getCurrentPreviewFileId();
      if (fileId) this.downloadFile(fileId);
    });

    document.getElementById('star-btn')?.addEventListener('click', async () => {
      const fileId = this.getCurrentPreviewFileId();
      if (fileId) await this.toggleStar(fileId);
    });

    document.getElementById('rename-btn')?.addEventListener('click', async () => {
      const fileId = this.getCurrentPreviewFileId();
      if (fileId) await this.renameFile(fileId);
    });

    document.getElementById('move-btn')?.addEventListener('click', async () => {
      const fileId = this.getCurrentPreviewFileId();
      if (fileId) await this.moveFile(fileId);
    });

    document.getElementById('duplicate-btn')?.addEventListener('click', async () => {
      const fileId = this.getCurrentPreviewFileId();
      if (fileId) await this.duplicateFile(fileId);
    });

    document.getElementById('delete-btn')?.addEventListener('click', async () => {
      const fileId = this.getCurrentPreviewFileId();
      if (fileId) await this.deleteFile(fileId);
    });

    document.getElementById('share-btn')?.addEventListener('click', async () => {
      const fileId = this.getCurrentPreviewFileId();
      if (fileId) await this.shareFile(fileId);
    });
    
    // Modal backdrops
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          const modal = backdrop.closest('.modal');
          hideModal(modal.id);
        }
      });
    });
    
    // Theme selection in settings
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.setTheme(e.target.value);
      });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-menu')) {
        document.getElementById('user-dropdown')?.classList.add('hidden');
      }
    });
  }

  /**
   * Setup upload modal functionality
   */
  setupUploadModal() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    
    if (!uploadArea || !fileInput) {
      console.error('Upload elements not found');
      return;
    }

    // Click to browse files
    uploadArea.addEventListener('click', (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    });

    // File selection handler
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this.handleFileSelection(Array.from(e.target.files));
      }
    });

    // Drag and drop functionality
    uploadArea.addEventListener('dragenter', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!uploadArea.contains(e.relatedTarget)) {
        uploadArea.classList.remove('drag-over');
      }
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        this.handleFileSelection(files);
      }
    });
  }

  /**
   * Handle file selection for upload
   */
  async handleFileSelection(files) {
    console.log('Files selected for upload:', files);
    
    // Filter files by size (1MB limit for free tier)
    const maxSize = 1024 * 1024; // 1MB
    const validFiles = [];
    const invalidFiles = [];
    
    files.forEach(file => {
      if (file.size <= maxSize) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file);
      }
    });
    
    // Show warnings for oversized files
    if (invalidFiles.length > 0) {
      showToast(
        `${invalidFiles.length} file(s) exceed the 1MB limit and will be skipped`,
        'warning'
      );
    }
    
    if (validFiles.length === 0) {
      showToast('No valid files to upload', 'error');
      return;
    }
    
    // Start upload process
    await this.uploadFiles(validFiles);
  }

  /**
   * Create a new folder
   */
  async createNewFolder() {
    try {
      const folderName = prompt('Enter folder name:');
      if (!folderName) return;
      
      if (!folderName.trim()) {
        showToast('Folder name cannot be empty', 'error');
        return;
      }
      
      // Create folder in Firestore
      const folderData = {
        name: folderName.trim(),
        type: 'folder',
        size: 0,
        path: this.currentPath.join('/'),
        created: new Date(),
        modified: new Date(),
        owner: authManager.getCurrentUser().uid,
        shared: false,
        starred: false
      };
      
      await firestoreManager.saveFile(folderData);
      await this.loadFiles();
      
      showToast(`Folder "${folderName}" created successfully`, 'success');
      
    } catch (error) {
      console.error('Failed to create folder:', error);
      showToast('Failed to create folder', 'error');
    }
  }

  /**
   * Upload files to Firestore storage
   */
  async uploadFiles(files) {
    try {
      // Use the imported upload handler
      for (const file of files) {
        await uploadHandler.uploadFile(file, this.currentPath.join('/'));
      }
      
      // Refresh file list after upload
      await this.loadFiles();
      
      // Close upload modal
      hideModal('upload-modal');
      
      showToast(`Successfully uploaded ${files.length} file(s)`, 'success');
      
    } catch (error) {
      console.error('Upload failed:', error);
      showToast('Upload failed: ' + error.message, 'error');
    }
  }

  /**
   * Switch between different views
   */
  async switchView(view) {
    if (this.currentView === view) return;
    
    this.currentView = view;
    this.currentPath = [];
    this.selectedFiles.clear();
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === view) {
        link.classList.add('active');
      }
    });
    
    // Load files for new view
    await this.loadFiles();
  }

  /**
   * Toggle theme
   */
  toggleTheme() {
    const themes = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(this.theme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    this.setTheme(nextTheme);
  }

  /**
   * Set theme
   */
  setTheme(theme) {
    this.theme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    this.updateThemeIcon();
    
    // Update radio button in settings
    const radio = document.querySelector(`input[name="theme"][value="${theme}"]`);
    if (radio) radio.checked = true;
  }

  /**
   * Toggle view mode between grid and list
   */
  toggleViewMode() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
    localStorage.setItem('viewMode', this.viewMode);
    
    // Update button icon
    const viewIcon = document.querySelector('.view-icon');
    if (viewIcon) {
      viewIcon.textContent = this.viewMode === 'grid' ? '☰' : '⊞';
    }
    
    this.renderFiles();
  }

  /**
   * Handle search input
   */
  handleSearch(query) {
    clearTimeout(this.searchDebounceTimer);
    
    this.searchDebounceTimer = setTimeout(() => {
      this.filterFiles(query);
    }, 300);
  }

  /**
   * Filter files based on search and filters
   */
  filterFiles(searchQuery = '') {
    const typeFilter = document.getElementById('type-filter')?.value || '';
    
    this.filteredFiles = this.files.filter(file => {
      // Search filter
      if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Type filter
      if (typeFilter) {
        const fileType = this.getFileCategory(file.type);
        if (fileType !== typeFilter) {
          return false;
        }
      }
      
      return true;
    });
    
    this.renderFiles();
  }

  /**
   * Get file category for filtering
   */
  getFileCategory(type) {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type === 'application/pdf' || type.includes('document') || type.includes('word') || 
        type.includes('excel') || type.includes('powerpoint') || type.startsWith('text/')) {
      return 'document';
    }
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) {
      return 'archive';
    }
    return 'other';
  }

  /**
   * Handle filter changes
   */
  handleFilter() {
    const searchInput = document.getElementById('search-input');
    this.filterFiles(searchInput?.value || '');
  }

  /**
   * Sort files
   */
  handleSort(sortBy) {
    this.filteredFiles.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'created':
          return new Date(b.created) - new Date(a.created);
        case 'modified':
        default:
          return new Date(b.modified || b.created) - new Date(a.modified || a.created);
      }
    });
    
    this.renderFiles();
  }

  /**
   * Toggle star status of a file
   */
  async toggleStar(fileId) {
    try {
      const file = this.files.find(f => f.id === fileId);
      if (!file) return;

      const newStarred = !file.starred;
      await firestoreManager.starFile(fileId, newStarred, this.user.uid);
      
      // Update local file object
      file.starred = newStarred;
      
      // Update UI
      this.renderFiles();
      this.updatePreviewInfo(file);
      
      showToast(`File ${newStarred ? 'starred' : 'unstarred'}`, 'success');
    } catch (error) {
      console.error('Error toggling star:', error);
      showToast('Error updating star status', 'error');
    }
  }

  /**
   * Rename a file
   */
  async renameFile(fileId) {
    try {
      const file = this.files.find(f => f.id === fileId);
      if (!file) return;

      const newName = prompt('Enter new filename:', file.name);
      if (!newName || newName === file.name) return;

      await firestoreManager.renameFile(fileId, newName, this.user.uid);
      
      // Update local file object
      file.name = newName;
      
      // Update UI
      this.renderFiles();
      document.getElementById('preview-filename').textContent = newName;
      
      showToast('File renamed successfully', 'success');
    } catch (error) {
      console.error('Error renaming file:', error);
      showToast('Error renaming file', 'error');
    }
  }

  /**
   * Move a file (placeholder - would need folder selection UI)
   */
  async moveFile(fileId) {
    showToast('Move functionality coming soon', 'info');
  }

  /**
   * Duplicate a file (placeholder - would need duplication logic)
   */
  async duplicateFile(fileId) {
    showToast('Duplicate functionality coming soon', 'info');
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId) {
    try {
      const file = this.files.find(f => f.id === fileId);
      if (!file) return;

      if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;

      await firestoreManager.trashFile(fileId, this.user.uid);
      
      // Remove from local files array
      this.files = this.files.filter(f => f.id !== fileId);
      this.filteredFiles = this.filteredFiles.filter(f => f.id !== fileId);
      
      // Close preview modal if this file was being previewed
      hideModal('preview-modal');
      
      // Update UI
      this.renderFiles();
      
      showToast('File moved to trash', 'success');
    } catch (error) {
      console.error('Error deleting file:', error);
      showToast('Error deleting file', 'error');
    }
  }

  /**
   * Share a file (placeholder - would need sharing UI)
   */
  async shareFile(fileId) {
    showToast('Share functionality coming soon', 'info');
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DriveNestApp();
});

export default DriveNestApp;

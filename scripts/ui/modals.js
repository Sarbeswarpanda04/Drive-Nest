/**
 * Drive Nest - Modals and Toasts UI Module
 * Handles modal dialogs, toasts, and notifications
 */

class ModalManager {
  constructor() {
    this.activeModals = new Set();
    this.toastContainer = null;
    this.toastQueue = [];
    this.maxToasts = 5;
    this.toastDuration = 5000; // 5 seconds
    
    this.init();
  }

  /**
   * Initialize modal manager
   */
  init() {
    this.setupToastContainer();
    this.setupModalEventListeners();
    this.setupKeyboardHandling();
  }

  /**
   * Setup toast container
   */
  setupToastContainer() {
    this.toastContainer = document.getElementById('toast-container');
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.id = 'toast-container';
      this.toastContainer.className = 'toast-container';
      document.body.appendChild(this.toastContainer);
    }
  }

  /**
   * Setup modal event listeners
   */
  setupModalEventListeners() {
    // Close modal when clicking backdrop
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-backdrop')) {
        const modal = e.target.closest('.modal');
        if (modal) {
          this.hideModal(modal.id);
        }
      }
    });

    // Close modal when clicking close button
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-close')) {
        const modal = e.target.closest('.modal');
        if (modal) {
          this.hideModal(modal.id);
        }
      }
    });
  }

  /**
   * Setup keyboard handling for modals
   */
  setupKeyboardHandling() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModals.size > 0) {
        const lastModal = Array.from(this.activeModals).pop();
        this.hideModal(lastModal);
      }
    });
  }

  /**
   * Show modal
   * @param {string} modalId Modal ID
   * @param {Object} options Modal options
   */
  showModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.error('Modal not found:', modalId);
      return;
    }

    // Add to active modals
    this.activeModals.add(modalId);

    // Show modal
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');

    // Focus management
    if (options.focusElement) {
      const elementToFocus = modal.querySelector(options.focusElement);
      if (elementToFocus) {
        elementToFocus.focus();
      }
    } else {
      // Focus first focusable element
      this.focusFirstElement(modal);
    }

    // Trap focus within modal
    this.trapFocus(modal);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Add animation class
    modal.classList.add('fade-in');

    console.log('Modal shown:', modalId);
  }

  /**
   * Hide modal
   * @param {string} modalId Modal ID
   */
  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.error('Modal not found:', modalId);
      return;
    }

    // Remove from active modals
    this.activeModals.delete(modalId);

    // Hide modal
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');

    // Restore body scroll if no more modals
    if (this.activeModals.size === 0) {
      document.body.style.overflow = '';
    }

    // Remove animation class
    modal.classList.remove('fade-in');

    // Clear any form data if specified
    if (modal.dataset.clearOnClose === 'true') {
      this.clearModalForms(modal);
    }

    console.log('Modal hidden:', modalId);
  }

  /**
   * Focus first focusable element in modal
   * @param {Element} modal Modal element
   */
  focusFirstElement(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  }

  /**
   * Trap focus within modal
   * @param {Element} modal Modal element
   */
  trapFocus(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          e.preventDefault();
        }
      }
    };

    // Remove existing listeners
    modal.removeEventListener('keydown', handleTabKey);
    
    // Add new listener
    modal.addEventListener('keydown', handleTabKey);
  }

  /**
   * Clear forms in modal
   * @param {Element} modal Modal element
   */
  clearModalForms(modal) {
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => form.reset());

    const inputs = modal.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      if (input.type !== 'submit' && input.type !== 'button') {
        input.value = '';
      }
    });
  }

  /**
   * Show confirmation dialog
   * @param {string} title Dialog title
   * @param {string} message Dialog message
   * @param {Object} options Dialog options
   * @returns {Promise<boolean>} User confirmation result
   */
  async showConfirmDialog(title, message, options = {}) {
    return new Promise((resolve) => {
      // Create confirmation modal
      const modalId = 'confirm-dialog-' + Date.now();
      const modal = this.createConfirmModal(modalId, title, message, options);
      
      document.body.appendChild(modal);

      // Setup event listeners
      const confirmBtn = modal.querySelector('.confirm-btn');
      const cancelBtn = modal.querySelector('.cancel-btn');

      const handleConfirm = () => {
        this.hideModal(modalId);
        document.body.removeChild(modal);
        resolve(true);
      };

      const handleCancel = () => {
        this.hideModal(modalId);
        document.body.removeChild(modal);
        resolve(false);
      };

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);

      // Show modal
      this.showModal(modalId, { focusElement: '.cancel-btn' });
    });
  }

  /**
   * Create confirmation modal HTML
   * @param {string} modalId Modal ID
   * @param {string} title Dialog title
   * @param {string} message Dialog message
   * @param {Object} options Dialog options
   * @returns {Element} Modal element
   */
  createConfirmModal(modalId, title, message, options) {
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal';
    modal.setAttribute('aria-hidden', 'true');
    
    const confirmText = options.confirmText || 'Confirm';
    const cancelText = options.cancelText || 'Cancel';
    const isDestructive = options.destructive || false;
    
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width: 400px;">
        <header class="modal-header">
          <h3>${this.escapeHtml(title)}</h3>
        </header>
        <div class="modal-body">
          <p>${this.escapeHtml(message)}</p>
        </div>
        <div style="padding: var(--space-lg); border-top: 1px solid var(--border-primary); display: flex; gap: var(--space-sm); justify-content: flex-end;">
          <button class="btn btn-secondary cancel-btn">${this.escapeHtml(cancelText)}</button>
          <button class="btn ${isDestructive ? 'btn-danger' : 'btn-primary'} confirm-btn">${this.escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    
    return modal;
  }

  /**
   * Show toast notification
   * @param {string} message Toast message
   * @param {string} type Toast type (success, error, warning, info)
   * @param {number} duration Toast duration in milliseconds
   */
  showToast(message, type = 'info', duration = this.toastDuration) {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add to queue if at max capacity
    if (this.toastContainer.children.length >= this.maxToasts) {
      this.toastQueue.push({ message, type, duration });
      return;
    }

    // Add to container
    this.toastContainer.appendChild(toast);

    // Auto remove after duration
    const timeout = setTimeout(() => {
      this.removeToast(toast);
    }, duration);

    // Add click to dismiss
    toast.addEventListener('click', () => {
      clearTimeout(timeout);
      this.removeToast(toast);
    });

    // Add remove button
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.className = 'toast-remove';
    removeBtn.style.cssText = `
      background: none;
      border: none;
      color: inherit;
      font-size: 18px;
      font-weight: bold;
      float: right;
      margin-left: 10px;
      cursor: pointer;
      opacity: 0.7;
      padding: 0;
      line-height: 1;
    `;
    
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearTimeout(timeout);
      this.removeToast(toast);
    });

    toast.appendChild(removeBtn);

    console.log('Toast shown:', message, type);
  }

  /**
   * Remove toast from container
   * @param {Element} toast Toast element
   */
  removeToast(toast) {
    if (!toast.parentNode) return;

    // Add fade out animation
    toast.classList.add('toast-out');
    
    setTimeout(() => {
      if (toast.parentNode) {
        this.toastContainer.removeChild(toast);
      }
      
      // Show next toast in queue
      if (this.toastQueue.length > 0) {
        const nextToast = this.toastQueue.shift();
        this.showToast(nextToast.message, nextToast.type, nextToast.duration);
      }
    }, 300);
  }

  /**
   * Clear all toasts
   */
  clearAllToasts() {
    Array.from(this.toastContainer.children).forEach(toast => {
      this.removeToast(toast);
    });
    this.toastQueue = [];
  }

  /**
   * Show loading overlay
   * @param {string} message Loading message
   * @returns {string} Loading overlay ID
   */
  showLoading(message = 'Loading...') {
    const loadingId = 'loading-' + Date.now();
    const loading = document.createElement('div');
    loading.id = loadingId;
    loading.className = 'loading-overlay';
    
    loading.innerHTML = `
      <div class="loading-backdrop"></div>
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-message">${this.escapeHtml(message)}</div>
      </div>
    `;
    
    loading.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    document.body.appendChild(loading);
    return loadingId;
  }

  /**
   * Hide loading overlay
   * @param {string} loadingId Loading overlay ID
   */
  hideLoading(loadingId) {
    const loading = document.getElementById(loadingId);
    if (loading && loading.parentNode) {
      document.body.removeChild(loading);
    }
  }

  /**
   * Show progress dialog
   * @param {string} title Progress title
   * @param {string} message Progress message
   * @returns {Object} Progress dialog controller
   */
  showProgress(title, message = '') {
    const progressId = 'progress-' + Date.now();
    const modal = document.createElement('div');
    modal.id = progressId;
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width: 400px;">
        <header class="modal-header">
          <h3>${this.escapeHtml(title)}</h3>
        </header>
        <div class="modal-body">
          <div class="progress-message">${this.escapeHtml(message)}</div>
          <div class="progress-bar" style="margin: var(--space-lg) 0;">
            <div class="progress-fill" style="width: 0%;"></div>
          </div>
          <div class="progress-details" style="font-size: var(--font-size-sm); color: var(--text-muted); display: flex; justify-content: space-between;">
            <span class="progress-percent">0%</span>
            <span class="progress-eta">Calculating...</span>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    this.showModal(progressId);
    
    return {
      update: (progress, speed, eta) => {
        const progressFill = modal.querySelector('.progress-fill');
        const progressPercent = modal.querySelector('.progress-percent');
        const progressEta = modal.querySelector('.progress-eta');
        
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressPercent) progressPercent.textContent = `${Math.round(progress)}%`;
        
        if (progressEta && eta !== undefined) {
          if (eta === Infinity || eta <= 0) {
            progressEta.textContent = 'Calculating...';
          } else {
            progressEta.textContent = this.formatDuration(eta);
          }
        }
      },
      
      setMessage: (message) => {
        const messageEl = modal.querySelector('.progress-message');
        if (messageEl) messageEl.textContent = message;
      },
      
      close: () => {
        this.hideModal(progressId);
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
      }
    };
  }

  /**
   * Hide progress dialog
   * @param {string} progressId Progress dialog ID (optional, hides most recent if not provided)
   */
  hideProgress(progressId) {
    if (progressId) {
      // Hide specific progress dialog
      this.hideModal(progressId);
      const modal = document.getElementById(progressId);
      if (modal && modal.parentNode) {
        document.body.removeChild(modal);
      }
    } else {
      // Hide most recent progress dialog
      const progressModals = document.querySelectorAll('[id^="progress-"]');
      if (progressModals.length > 0) {
        const lastModal = progressModals[progressModals.length - 1];
        this.hideModal(lastModal.id);
        if (lastModal.parentNode) {
          document.body.removeChild(lastModal);
        }
      }
    }
  }

  /**
   * Update progress dialog
   * @param {string} progressId Progress dialog ID
   * @param {number} progress Progress percentage (0-100)
   * @param {number} speed Transfer speed (optional)
   * @param {number} eta Estimated time remaining in seconds (optional)
   */
  updateProgress(progressId, progress, speed, eta) {
    const modal = document.getElementById(progressId);
    if (!modal) return;

    const progressFill = modal.querySelector('.progress-fill');
    const progressPercent = modal.querySelector('.progress-percent');
    const progressEta = modal.querySelector('.progress-eta');
    
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressPercent) progressPercent.textContent = `${Math.round(progress)}%`;
    
    if (progressEta && eta !== undefined) {
      if (eta === Infinity || eta <= 0) {
        progressEta.textContent = 'Calculating...';
      } else {
        progressEta.textContent = this.formatDuration(eta);
      }
    }
  }

  /**
   * Format duration in seconds to human readable string
   * @param {number} seconds Duration in seconds
   * @returns {string} Formatted duration
   */
  formatDuration(seconds) {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${minutes}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show input dialog
   * @param {string} title Dialog title
   * @param {string} message Dialog message
   * @param {Object} options Dialog options
   * @returns {Promise<string|null>} User input or null if cancelled
   */
  async showInputDialog(title, message, options = {}) {
    return new Promise((resolve) => {
      const modalId = 'input-dialog-' + Date.now();
      const modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal';
      
      const placeholder = options.placeholder || '';
      const defaultValue = options.defaultValue || '';
      const inputType = options.inputType || 'text';
      
      modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content" style="max-width: 400px;">
          <header class="modal-header">
            <h3>${this.escapeHtml(title)}</h3>
          </header>
          <div class="modal-body">
            <p style="margin-bottom: var(--space-lg);">${this.escapeHtml(message)}</p>
            <input type="${inputType}" class="input-field" placeholder="${this.escapeHtml(placeholder)}" value="${this.escapeHtml(defaultValue)}" style="width: 100%; padding: var(--space-sm) var(--space-md); border: 1px solid var(--border-primary); border-radius: var(--radius-md); font-size: var(--font-size-base);">
          </div>
          <div style="padding: var(--space-lg); border-top: 1px solid var(--border-primary); display: flex; gap: var(--space-sm); justify-content: flex-end;">
            <button class="btn btn-secondary cancel-btn">Cancel</button>
            <button class="btn btn-primary confirm-btn">OK</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      const inputField = modal.querySelector('.input-field');
      const confirmBtn = modal.querySelector('.confirm-btn');
      const cancelBtn = modal.querySelector('.cancel-btn');
      
      const handleConfirm = () => {
        const value = inputField.value.trim();
        this.hideModal(modalId);
        document.body.removeChild(modal);
        resolve(value || null);
      };
      
      const handleCancel = () => {
        this.hideModal(modalId);
        document.body.removeChild(modal);
        resolve(null);
      };
      
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      
      inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        }
      });
      
      this.showModal(modalId, { focusElement: '.input-field' });
      
      // Select text in input
      setTimeout(() => {
        inputField.select();
      }, 100);
    });
  }
}

// Create global modal manager instance
const modalManager = new ModalManager();

// Export convenience functions
export function showModal(modalId, options) {
  return modalManager.showModal(modalId, options);
}

export function hideModal(modalId) {
  return modalManager.hideModal(modalId);
}

export function showToast(message, type, duration) {
  return modalManager.showToast(message, type, duration);
}

export function showConfirmDialog(title, message, options) {
  return modalManager.showConfirmDialog(title, message, options);
}

export function showInputDialog(title, message, options) {
  return modalManager.showInputDialog(title, message, options);
}

export function showLoading(message) {
  return modalManager.showLoading(message);
}

export function hideLoading(loadingId) {
  return modalManager.hideLoading(loadingId);
}

export function showProgress(title, message) {
  return modalManager.showProgress(title, message);
}

export function hideProgress(progressId) {
  return modalManager.hideProgress(progressId);
}

export function updateProgress(progressId, progress, speed, eta) {
  return modalManager.updateProgress(progressId, progress, speed, eta);
}

// Make functions globally available
window.showModal = showModal;
window.hideModal = hideModal;
window.showToast = showToast;
window.showConfirmDialog = showConfirmDialog;
window.showInputDialog = showInputDialog;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showProgress = showProgress;
window.hideProgress = hideProgress;
window.updateProgress = updateProgress;

export default modalManager;

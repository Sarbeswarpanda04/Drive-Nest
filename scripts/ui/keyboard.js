/**
 * Drive Nest - Keyboard Shortcuts Module
 * Handles keyboard shortcuts and accessibility
 */

class KeyboardManager {
  constructor() {
    this.shortcuts = new Map();
    this.isEnabled = true;
    this.activeModals = new Set();
    
    this.init();
  }

  /**
   * Initialize keyboard manager
   */
  init() {
    this.setupDefaultShortcuts();
    this.setupEventListeners();
    this.setupHelpDialog();
  }

  /**
   * Setup default keyboard shortcuts
   */
  setupDefaultShortcuts() {
    // Navigation shortcuts
    this.addShortcut('/', () => {
      this.focusSearch();
    }, 'Focus search bar');

    this.addShortcut('u', () => {
      if (window.app) {
        window.showModal('upload-modal');
      }
    }, 'Upload files');

    this.addShortcut('Delete', () => {
      this.deleteSelectedFiles();
    }, 'Delete selected files');

    this.addShortcut('r', () => {
      this.renameSelectedFile();
    }, 'Rename selected file');

    this.addShortcut('s', () => {
      this.starSelectedFiles();
    }, 'Star/unstar selected files');

    // View shortcuts with 'g' prefix
    this.addShortcut('g m', () => {
      this.switchView('my-files');
    }, 'Go to My Files');

    this.addShortcut('g s', () => {
      this.switchView('shared');
    }, 'Go to Shared with me');

    this.addShortcut('g r', () => {
      this.switchView('recent');
    }, 'Go to Recent files');

    this.addShortcut('g t', () => {
      this.switchView('trash');
    }, 'Go to Trash');

    this.addShortcut('g a', () => {
      this.switchView('starred');
    }, 'Go to Starred files');

    // Selection shortcuts
    this.addShortcut('Ctrl+a', () => {
      this.selectAllFiles();
    }, 'Select all files');

    this.addShortcut('Escape', () => {
      this.clearSelection();
    }, 'Clear selection');

    // View mode shortcuts
    this.addShortcut('v', () => {
      if (window.app) {
        window.app.toggleViewMode();
      }
    }, 'Toggle view mode (grid/list)');

    // Theme shortcuts
    this.addShortcut('t', () => {
      if (window.app) {
        window.app.toggleTheme();
      }
    }, 'Toggle theme');

    // Settings
    this.addShortcut(',', () => {
      window.showModal('settings-modal');
    }, 'Open settings');

    // Help
    this.addShortcut('?', () => {
      this.showHelpDialog();
    }, 'Show keyboard shortcuts help');

    // Download
    this.addShortcut('d', () => {
      this.downloadSelectedFiles();
    }, 'Download selected files');

    // Share
    this.addShortcut('Shift+s', () => {
      this.shareSelectedFile();
    }, 'Share selected file');

    // Duplicate
    this.addShortcut('Ctrl+d', () => {
      this.duplicateSelectedFile();
    }, 'Duplicate selected file');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    document.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Track modal state
    document.addEventListener('DOMContentLoaded', () => {
      const modals = document.querySelectorAll('.modal');
      modals.forEach(modal => {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
              if (modal.classList.contains('hidden')) {
                this.activeModals.delete(modal.id);
              } else {
                this.activeModals.add(modal.id);
              }
            }
          });
        });
        
        observer.observe(modal, { attributes: true });
      });
    });
  }

  /**
   * Handle keydown events
   * @param {KeyboardEvent} e Keyboard event
   */
  handleKeyDown(e) {
    if (!this.isEnabled) return;

    // Don't handle shortcuts when typing in inputs
    if (this.isTypingInInput(e.target)) {
      return;
    }

    // Don't handle shortcuts when modal is open (except escape)
    if (this.activeModals.size > 0 && e.key !== 'Escape') {
      return;
    }

    const shortcut = this.getShortcutString(e);
    const handler = this.shortcuts.get(shortcut);

    if (handler) {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        handler.callback();
      } catch (error) {
        console.error('Error executing keyboard shortcut:', error);
      }
    }
  }

  /**
   * Check if user is typing in an input field
   * @param {Element} target Event target
   * @returns {boolean} True if typing in input
   */
  isTypingInInput(target) {
    const inputTypes = ['INPUT', 'TEXTAREA', 'SELECT'];
    return inputTypes.includes(target.tagName) || target.contentEditable === 'true';
  }

  /**
   * Get shortcut string from keyboard event
   * @param {KeyboardEvent} e Keyboard event
   * @returns {string} Shortcut string
   */
  getShortcutString(e) {
    const parts = [];
    
    if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    
    // Special handling for certain keys
    let key = e.key;
    if (key === ' ') key = 'Space';
    if (key === 'ArrowUp') key = 'Up';
    if (key === 'ArrowDown') key = 'Down';
    if (key === 'ArrowLeft') key = 'Left';
    if (key === 'ArrowRight') key = 'Right';
    
    parts.push(key);
    
    return parts.join('+');
  }

  /**
   * Add keyboard shortcut
   * @param {string} shortcut Shortcut string
   * @param {Function} callback Callback function
   * @param {string} description Description for help
   */
  addShortcut(shortcut, callback, description = '') {
    // Handle sequence shortcuts (e.g., "g m")
    if (shortcut.includes(' ')) {
      this.addSequenceShortcut(shortcut, callback, description);
      return;
    }

    this.shortcuts.set(shortcut, {
      callback,
      description,
      shortcut
    });
  }

  /**
   * Add sequence shortcut (multiple key presses)
   * @param {string} sequence Sequence string
   * @param {Function} callback Callback function
   * @param {string} description Description
   */
  addSequenceShortcut(sequence, callback, description) {
    const keys = sequence.split(' ');
    let currentSequence = [];
    let sequenceTimeout = null;

    const originalHandler = this.shortcuts.get(keys[0]);
    
    this.shortcuts.set(keys[0], {
      callback: () => {
        clearTimeout(sequenceTimeout);
        currentSequence = [keys[0]];
        
        sequenceTimeout = setTimeout(() => {
          currentSequence = [];
        }, 1000); // 1 second timeout for sequence

        // If this is a single key shortcut, execute original handler
        if (keys.length === 1) {
          callback();
          return;
        }

        // Wait for next key in sequence
        const nextKeyHandler = (e) => {
          const nextKey = e.key;
          
          if (currentSequence.length < keys.length && nextKey === keys[currentSequence.length]) {
            currentSequence.push(nextKey);
            
            if (currentSequence.length === keys.length) {
              // Sequence complete
              e.preventDefault();
              e.stopPropagation();
              callback();
              document.removeEventListener('keydown', nextKeyHandler);
              clearTimeout(sequenceTimeout);
              currentSequence = [];
            }
          } else {
            // Wrong key, reset sequence
            document.removeEventListener('keydown', nextKeyHandler);
            clearTimeout(sequenceTimeout);
            currentSequence = [];
          }
        };

        document.addEventListener('keydown', nextKeyHandler);
      },
      description,
      shortcut: sequence
    });
  }

  /**
   * Remove keyboard shortcut
   * @param {string} shortcut Shortcut string
   */
  removeShortcut(shortcut) {
    this.shortcuts.delete(shortcut);
  }

  /**
   * Enable/disable keyboard shortcuts
   * @param {boolean} enabled Enable state
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  // ============ SHORTCUT IMPLEMENTATIONS ============

  /**
   * Focus search input
   */
  focusSearch() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }

  /**
   * Switch to a view
   * @param {string} view View name
   */
  switchView(view) {
    if (window.app) {
      window.app.switchView(view);
    }
  }

  /**
   * Delete selected files
   */
  deleteSelectedFiles() {
    if (window.app && window.app.selectedFiles.size > 0) {
      const fileCount = window.app.selectedFiles.size;
      const message = fileCount === 1 
        ? 'Are you sure you want to move this file to trash?'
        : `Are you sure you want to move ${fileCount} files to trash?`;
      
      window.showConfirmDialog(
        'Move to Trash',
        message,
        { destructive: true }
      ).then((confirmed) => {
        if (confirmed) {
          // Implement delete functionality
          this.performDeleteAction();
        }
      });
    }
  }

  /**
   * Rename selected file
   */
  renameSelectedFile() {
    if (window.app && window.app.selectedFiles.size === 1) {
      const fileId = Array.from(window.app.selectedFiles)[0];
      const file = window.app.files.find(f => f.id === fileId);
      
      if (file) {
        window.showInputDialog(
          'Rename File',
          'Enter new name:',
          { 
            defaultValue: file.name,
            placeholder: 'File name'
          }
        ).then((newName) => {
          if (newName && newName !== file.name) {
            // Implement rename functionality
            this.performRenameAction(fileId, newName);
          }
        });
      }
    }
  }

  /**
   * Star/unstar selected files
   */
  starSelectedFiles() {
    if (window.app && window.app.selectedFiles.size > 0) {
      // Implement star/unstar functionality
      this.performStarAction();
    }
  }

  /**
   * Select all files
   */
  selectAllFiles() {
    if (window.app) {
      window.app.selectedFiles.clear();
      window.app.filteredFiles.forEach(file => {
        window.app.selectedFiles.add(file.id);
      });
      window.app.renderFiles();
    }
  }

  /**
   * Clear selection
   */
  clearSelection() {
    if (window.app) {
      window.app.selectedFiles.clear();
      window.app.renderFiles();
    }
  }

  /**
   * Download selected files
   */
  downloadSelectedFiles() {
    if (window.app && window.app.selectedFiles.size > 0) {
      // Implement download functionality
      this.performDownloadAction();
    }
  }

  /**
   * Share selected file
   */
  shareSelectedFile() {
    if (window.app && window.app.selectedFiles.size === 1) {
      const fileId = Array.from(window.app.selectedFiles)[0];
      // Show share modal for the selected file
      window.showModal('share-modal');
      // Set the file in share modal
      this.setShareModalFile(fileId);
    }
  }

  /**
   * Duplicate selected file
   */
  duplicateSelectedFile() {
    if (window.app && window.app.selectedFiles.size === 1) {
      const fileId = Array.from(window.app.selectedFiles)[0];
      // Implement duplicate functionality
      this.performDuplicateAction(fileId);
    }
  }

  // ============ ACTION IMPLEMENTATIONS ============

  /**
   * Perform delete action
   */
  async performDeleteAction() {
    try {
      const fileIds = Array.from(window.app.selectedFiles);
      
      // Show progress if multiple files
      let progress = null;
      if (fileIds.length > 1) {
        progress = window.showProgress('Deleting Files', `Deleting ${fileIds.length} files...`);
      }

      for (let i = 0; i < fileIds.length; i++) {
        const fileId = fileIds[i];
        await window.firestore.trashFile(fileId, window.app.user.uid);
        
        if (progress) {
          progress.update(((i + 1) / fileIds.length) * 100);
        }
      }

      if (progress) {
        progress.close();
      }

      window.showToast(
        fileIds.length === 1 
          ? 'File moved to trash' 
          : `${fileIds.length} files moved to trash`,
        'success'
      );

      // Clear selection and reload files
      window.app.selectedFiles.clear();
      await window.app.loadFiles();

    } catch (error) {
      console.error('Error deleting files:', error);
      window.showToast('Error deleting files', 'error');
    }
  }

  /**
   * Perform rename action
   * @param {string} fileId File ID
   * @param {string} newName New name
   */
  async performRenameAction(fileId, newName) {
    try {
      await window.firestore.renameFile(fileId, newName, window.app.user.uid);
      window.showToast('File renamed successfully', 'success');
      
      // Reload files
      await window.app.loadFiles();
    } catch (error) {
      console.error('Error renaming file:', error);
      window.showToast('Error renaming file', 'error');
    }
  }

  /**
   * Perform star action
   */
  async performStarAction() {
    try {
      const fileIds = Array.from(window.app.selectedFiles);
      
      // Determine if we're starring or unstarring
      const files = fileIds.map(id => window.app.files.find(f => f.id === id));
      const hasUnstarred = files.some(file => !file.starred);
      const action = hasUnstarred; // Star if any are unstarred

      for (const fileId of fileIds) {
        await window.firestore.starFile(fileId, action, window.app.user.uid);
      }

      window.showToast(
        action 
          ? (fileIds.length === 1 ? 'File starred' : `${fileIds.length} files starred`)
          : (fileIds.length === 1 ? 'File unstarred' : `${fileIds.length} files unstarred`),
        'success'
      );

      // Reload files
      await window.app.loadFiles();
    } catch (error) {
      console.error('Error starring files:', error);
      window.showToast('Error updating starred files', 'error');
    }
  }

  /**
   * Perform download action
   */
  async performDownloadAction() {
    try {
      const fileIds = Array.from(window.app.selectedFiles);
      
      if (fileIds.length === 1) {
        // Single file download
        await window.app.downloadFile(fileIds[0]);
      } else {
        // Multiple files - would need to create zip
        window.showToast('Multiple file download not implemented yet', 'info');
      }
    } catch (error) {
      console.error('Error downloading files:', error);
      window.showToast('Error downloading files', 'error');
    }
  }

  /**
   * Set file in share modal
   * @param {string} fileId File ID
   */
  setShareModalFile(fileId) {
    // Implementation would depend on share modal structure
    console.log('Setting share modal for file:', fileId);
  }

  /**
   * Perform duplicate action
   * @param {string} fileId File ID
   */
  async performDuplicateAction(fileId) {
    try {
      // Implementation would depend on duplicate functionality
      console.log('Duplicating file:', fileId);
      window.showToast('Duplicate functionality not implemented yet', 'info');
    } catch (error) {
      console.error('Error duplicating file:', error);
      window.showToast('Error duplicating file', 'error');
    }
  }

  // ============ HELP DIALOG ============

  /**
   * Setup help dialog
   */
  setupHelpDialog() {
    const helpModal = document.createElement('div');
    helpModal.id = 'keyboard-help-modal';
    helpModal.className = 'modal hidden';
    
    helpModal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" style="max-width: 600px;">
        <header class="modal-header">
          <h3>Keyboard Shortcuts</h3>
          <button class="btn btn-secondary modal-close">✕</button>
        </header>
        <div class="modal-body">
          <div id="shortcuts-list" class="shortcuts-list"></div>
        </div>
      </div>
    `;
    
    document.body.appendChild(helpModal);
  }

  /**
   * Show help dialog
   */
  showHelpDialog() {
    const shortcutsList = document.getElementById('shortcuts-list');
    if (!shortcutsList) return;

    // Group shortcuts by category
    const categories = {
      'Navigation': ['/', 'g m', 'g s', 'g r', 'g t', 'g a'],
      'File Actions': ['u', 'Delete', 'r', 's', 'd', 'Shift+s', 'Ctrl+d'],
      'Selection': ['Ctrl+a', 'Escape'],
      'View': ['v', 't'],
      'Other': [',', '?']
    };

    let html = '';
    
    Object.entries(categories).forEach(([category, shortcuts]) => {
      html += `<h4 style="margin-top: var(--space-lg); margin-bottom: var(--space-md); color: var(--brand);">${category}</h4>`;
      html += '<div style="display: grid; gap: var(--space-sm);">';
      
      shortcuts.forEach(shortcut => {
        const handler = this.shortcuts.get(shortcut);
        if (handler) {
          html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-xs) 0;">
              <span>${handler.description}</span>
              <kbd style="
                background: var(--bg-secondary);
                border: 1px solid var(--border-primary);
                border-radius: var(--radius-sm);
                padding: var(--space-xs) var(--space-sm);
                font-size: var(--font-size-xs);
                font-family: monospace;
              ">${this.formatShortcutForDisplay(shortcut)}</kbd>
            </div>
          `;
        }
      });
      
      html += '</div>';
    });

    shortcutsList.innerHTML = html;
    window.showModal('keyboard-help-modal');
  }

  /**
   * Format shortcut for display
   * @param {string} shortcut Shortcut string
   * @returns {string} Formatted shortcut
   */
  formatShortcutForDisplay(shortcut) {
    return shortcut
      .replace(/Ctrl/g, '⌃')
      .replace(/Alt/g, '⌥')
      .replace(/Shift/g, '⇧')
      .replace(/\+/g, ' + ')
      .replace(/Space/g, '␣');
  }

  /**
   * Get all registered shortcuts
   * @returns {Map} Shortcuts map
   */
  getShortcuts() {
    return this.shortcuts;
  }

  /**
   * Reset to default shortcuts
   */
  resetToDefaults() {
    this.shortcuts.clear();
    this.setupDefaultShortcuts();
  }
}

/**
 * Setup keyboard shortcuts for the app
 * @param {Object} app App instance
 */
export function setupKeyboardShortcuts(app) {
  // Store app reference globally for shortcuts to access
  window.app = app;
  
  // Create keyboard manager
  const keyboardManager = new KeyboardManager();
  
  // Store reference for cleanup if needed
  app.keyboardManager = keyboardManager;
  
  return keyboardManager;
}

export default KeyboardManager;

/**
 * Drive Nest - DOCX Preview Module
 * Handles DOCX file previews using docx-preview library
 */

class DOCXPreviewManager {
  constructor() {
    this.isLibraryLoaded = false;
    this.libraryPromise = null;
  }

  /**
   * Load docx-preview library if not already loaded
   * @returns {Promise<void>}
   */
  async loadLibrary() {
    if (this.isLibraryLoaded) {
      return Promise.resolve();
    }

    if (this.libraryPromise) {
      return this.libraryPromise;
    }

    this.libraryPromise = new Promise((resolve, reject) => {
      // Load docx-preview from CDN
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/docx-preview@0.1.20/dist/docx-preview.min.js';
      script.onload = () => {
        if (window.docx) {
          this.isLibraryLoaded = true;
          console.log('docx-preview library loaded successfully');
          resolve();
        } else {
          reject(new Error('Failed to load docx-preview library'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load docx-preview script'));
      };
      document.head.appendChild(script);
    });

    return this.libraryPromise;
  }

  /**
   * Create DOCX preview
   * @param {string} url DOCX file URL
   * @param {Element} container Container element
   * @param {Object} options Preview options
   * @returns {Promise<Object>} Preview controller
   */
  async createPreview(url, container, options = {}) {
    try {
      // First try client-side preview
      return await this.createClientPreview(url, container, options);
    } catch (error) {
      console.warn('Client-side DOCX preview failed, trying fallback:', error);
      return this.createFallbackPreview(url, container, options);
    }
  }

  /**
   * Create client-side DOCX preview
   * @param {string} url DOCX file URL
   * @param {Element} container Container element
   * @param {Object} options Preview options
   * @returns {Promise<Object>} Preview controller
   */
  async createClientPreview(url, container, options = {}) {
    try {
      await this.loadLibrary();

      // Show loading state
      container.innerHTML = `
        <div class="docx-loading">
          <div class="loading-spinner"></div>
          <div>Loading document...</div>
        </div>
      `;

      // Fetch the DOCX file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Clear container and create viewer structure
      const viewer = this.createViewerStructure(container, options);

      // Render the document
      await window.docx.renderAsync(arrayBuffer, viewer.content, null, {
        className: 'docx-document',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: true,
        experimental: false,
        trimXmlDeclaration: true,
        useBase64URL: false,
        useMathMLPolyfill: true
      });

      console.log('DOCX document rendered successfully');

      // Setup controls
      this.setupControls(viewer);

      return {
        viewer,
        zoom: (factor) => this.zoom(viewer, factor),
        print: () => this.print(viewer),
        destroy: () => this.destroyPreview(viewer)
      };

    } catch (error) {
      console.error('Error creating client-side DOCX preview:', error);
      throw error;
    }
  }

  /**
   * Create fallback preview using Office Online or Google Docs
   * @param {string} url DOCX file URL
   * @param {Element} container Container element
   * @param {Object} options Preview options
   * @returns {Object} Preview controller
   */
  createFallbackPreview(url, container, options = {}) {
    try {
      // Try Office Online first
      const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      
      const viewer = this.createFallbackViewerStructure(container, url, officeUrl);
      
      // Check if Office Online works
      const iframe = viewer.iframe;
      let fallbackAttempted = false;
      
      iframe.onload = () => {
        console.log('Office Online preview loaded');
      };
      
      iframe.onerror = () => {
        if (!fallbackAttempted) {
          fallbackAttempted = true;
          console.log('Office Online failed, trying Google Docs');
          
          // Try Google Docs viewer
          const googleUrl = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
          iframe.src = googleUrl;
          
          iframe.onerror = () => {
            console.log('Google Docs viewer also failed');
            this.showFallbackError(viewer, url);
          };
        }
      };

      return {
        viewer,
        destroy: () => this.destroyPreview(viewer)
      };

    } catch (error) {
      console.error('Error creating fallback DOCX preview:', error);
      return this.createErrorPreview(container, url, error);
    }
  }

  /**
   * Create viewer structure for client-side preview
   * @param {Element} container Container element
   * @param {Object} options Options
   * @returns {Object} Viewer elements
   */
  createViewerStructure(container, options) {
    const viewerHTML = `
      <div class="docx-viewer">
        <div class="docx-toolbar">
          <div class="docx-controls">
            <button class="btn btn-secondary docx-zoom-out" title="Zoom out">
              −
            </button>
            <span class="docx-zoom-level">100%</span>
            <button class="btn btn-secondary docx-zoom-in" title="Zoom in">
              +
            </button>
            <button class="btn btn-secondary docx-fit" title="Fit to width">
              Fit
            </button>
          </div>
          <div class="docx-actions">
            <button class="btn btn-secondary docx-print" title="Print">
              🖨️ Print
            </button>
            <button class="btn btn-primary docx-download" title="Download">
              ⬇ Download
            </button>
          </div>
        </div>
        <div class="docx-content-container">
          <div class="docx-content"></div>
        </div>
      </div>
    `;

    container.innerHTML = viewerHTML;

    return {
      container: container.querySelector('.docx-viewer'),
      toolbar: container.querySelector('.docx-toolbar'),
      content: container.querySelector('.docx-content'),
      contentContainer: container.querySelector('.docx-content-container'),
      zoomOutBtn: container.querySelector('.docx-zoom-out'),
      zoomInBtn: container.querySelector('.docx-zoom-in'),
      zoomLevel: container.querySelector('.docx-zoom-level'),
      fitBtn: container.querySelector('.docx-fit'),
      printBtn: container.querySelector('.docx-print'),
      downloadBtn: container.querySelector('.docx-download'),
      scale: 1.0
    };
  }

  /**
   * Create fallback viewer structure using iframe
   * @param {Element} container Container element
   * @param {string} originalUrl Original file URL
   * @param {string} viewerUrl Viewer URL
   * @returns {Object} Viewer elements
   */
  createFallbackViewerStructure(container, originalUrl, viewerUrl) {
    const viewerHTML = `
      <div class="docx-fallback-viewer">
        <div class="docx-toolbar">
          <div class="docx-info">
            <span class="docx-provider">Online Viewer</span>
          </div>
          <div class="docx-actions">
            <button class="btn btn-secondary" onclick="window.open('${originalUrl}', '_blank')" title="Open in new tab">
              🔗 Open in new tab
            </button>
            <button class="btn btn-primary" onclick="this.click()" title="Download">
              ⬇ Download
            </button>
          </div>
        </div>
        <div class="docx-iframe-container">
          <iframe 
            src="${viewerUrl}" 
            class="docx-iframe"
            frameborder="0"
            allowfullscreen
            title="Document Preview">
          </iframe>
        </div>
      </div>
    `;

    container.innerHTML = viewerHTML;

    const downloadBtn = container.querySelector('.docx-actions .btn-primary');
    downloadBtn.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = originalUrl;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    return {
      container: container.querySelector('.docx-fallback-viewer'),
      iframe: container.querySelector('.docx-iframe'),
      toolbar: container.querySelector('.docx-toolbar')
    };
  }

  /**
   * Setup viewer controls
   * @param {Object} viewer Viewer elements
   */
  setupControls(viewer) {
    // Zoom controls
    viewer.zoomOutBtn.addEventListener('click', () => {
      this.zoom(viewer, viewer.scale * 0.8);
    });

    viewer.zoomInBtn.addEventListener('click', () => {
      this.zoom(viewer, viewer.scale * 1.2);
    });

    viewer.fitBtn.addEventListener('click', () => {
      this.fitToWidth(viewer);
    });

    viewer.printBtn.addEventListener('click', () => {
      this.print(viewer);
    });

    // Mouse wheel zoom
    viewer.contentContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom(viewer, viewer.scale * delta);
      }
    });
  }

  /**
   * Zoom document
   * @param {Object} viewer Viewer elements
   * @param {number} scale Scale factor
   */
  zoom(viewer, scale) {
    // Limit zoom range
    scale = Math.max(0.5, Math.min(3.0, scale));
    
    viewer.scale = scale;
    viewer.content.style.transform = `scale(${scale})`;
    viewer.content.style.transformOrigin = 'top left';
    
    viewer.zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  }

  /**
   * Fit document to container width
   * @param {Object} viewer Viewer elements
   */
  fitToWidth(viewer) {
    const containerWidth = viewer.contentContainer.clientWidth - 40; // Account for padding
    const contentWidth = viewer.content.scrollWidth;
    const scale = containerWidth / contentWidth;
    
    this.zoom(viewer, scale);
  }

  /**
   * Print document
   * @param {Object} viewer Viewer elements
   */
  print(viewer) {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Document</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
              }
              .docx-document { 
                max-width: none !important; 
              }
              @media print {
                body { margin: 0; padding: 0; }
              }
            </style>
          </head>
          <body>
            ${viewer.content.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  }

  /**
   * Show fallback error
   * @param {Object} viewer Viewer elements
   * @param {string} url File URL
   */
  showFallbackError(viewer, url) {
    viewer.container.innerHTML = `
      <div class="docx-error">
        <div class="error-icon">📄</div>
        <h3>Cannot preview document</h3>
        <p>This document cannot be previewed online. Please download it to view.</p>
        <div class="error-actions">
          <button class="btn btn-primary" onclick="window.open('${url}', '_blank')">
            Download Document
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Create error preview
   * @param {Element} container Container element
   * @param {string} url File URL
   * @param {Error} error Error object
   * @returns {Object} Error preview
   */
  createErrorPreview(container, url, error) {
    container.innerHTML = `
      <div class="docx-error">
        <div class="error-icon">⚠️</div>
        <h3>Preview not available</h3>
        <p>Error: ${error.message}</p>
        <div class="error-actions">
          <button class="btn btn-primary" onclick="window.open('${url}', '_blank')">
            Download Document
          </button>
        </div>
      </div>
    `;

    return {
      destroy: () => {
        container.innerHTML = '';
      }
    };
  }

  /**
   * Destroy preview and cleanup
   * @param {Object} viewer Viewer elements
   */
  destroyPreview(viewer) {
    if (viewer && viewer.container) {
      viewer.container.innerHTML = '';
    }
  }

  /**
   * Check if DOCX preview is supported
   * @returns {boolean} True if supported
   */
  isSupported() {
    return typeof window !== 'undefined' && 'fetch' in window;
  }

  /**
   * Check if a URL is accessible for preview
   * @param {string} url File URL
   * @returns {Promise<boolean>} True if accessible
   */
  async isUrlAccessible(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.warn('URL accessibility check failed:', error);
      return false;
    }
  }
}

// CSS styles for DOCX viewer
const docxStyles = `
.docx-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.docx-fallback-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.docx-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--surface);
  border-bottom: 1px solid var(--border-primary);
  gap: var(--space-md);
  flex-shrink: 0;
}

.docx-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.docx-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.docx-zoom-level {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  min-width: 40px;
  text-align: center;
}

.docx-content-container {
  flex: 1;
  overflow: auto;
  padding: var(--space-lg);
  background: white;
}

.docx-content {
  background: white;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  margin: 0 auto;
  transform-origin: top left;
  transition: transform 0.2s ease;
}

.docx-document {
  padding: var(--space-xl);
  line-height: 1.6;
  color: #000;
  font-family: 'Times New Roman', serif;
}

.docx-iframe-container {
  flex: 1;
  position: relative;
}

.docx-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

.docx-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--text-muted);
  gap: var(--space-md);
}

.docx-error {
  text-align: center;
  padding: var(--space-3xl);
  color: var(--text-muted);
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.docx-error .error-icon {
  font-size: 3rem;
  margin-bottom: var(--space-lg);
}

.error-actions {
  margin-top: var(--space-lg);
}

.docx-info {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
}

.docx-provider {
  font-weight: var(--font-weight-medium);
}

/* Responsive styles */
@media (max-width: 768px) {
  .docx-toolbar {
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-sm);
  }
  
  .docx-controls,
  .docx-actions {
    gap: var(--space-xs);
  }
  
  .docx-content-container {
    padding: var(--space-md);
  }
  
  .docx-document {
    padding: var(--space-lg);
    font-size: var(--font-size-sm);
  }
}

/* Print styles */
@media print {
  .docx-toolbar {
    display: none !important;
  }
  
  .docx-content-container {
    padding: 0 !important;
    overflow: visible !important;
  }
  
  .docx-content {
    box-shadow: none !important;
    transform: none !important;
  }
}
`;

// Inject DOCX styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = docxStyles;
  document.head.appendChild(styleSheet);
}

// Create and export DOCX preview manager instance
const docxPreviewManager = new DOCXPreviewManager();

export default docxPreviewManager;

/**
 * Drive Nest - PDF Preview Module
 * Handles PDF file previews using PDF.js
 */

class PDFPreviewManager {
  constructor() {
    this.isLibraryLoaded = false;
    this.libraryPromise = null;
  }

  /**
   * Load PDF.js library if not already loaded
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
      // Load PDF.js from CDN
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        // Configure PDF.js worker
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          this.isLibraryLoaded = true;
          console.log('PDF.js library loaded successfully');
          resolve();
        } else {
          reject(new Error('Failed to load PDF.js library'));
        }
      };
      script.onerror = () => {
        reject(new Error('Failed to load PDF.js script'));
      };
      document.head.appendChild(script);
    });

    return this.libraryPromise;
  }

  /**
   * Create PDF preview
   * @param {string} url PDF file URL
   * @param {Element} container Container element
   * @param {Object} options Preview options
   * @returns {Promise<Object>} Preview controller
   */
  async createPreview(url, container, options = {}) {
    try {
      await this.loadLibrary();

      const pdfDoc = await window.pdfjsLib.getDocument(url).promise;
      console.log('PDF loaded. Pages:', pdfDoc.numPages);

      // Clear container
      container.innerHTML = '';
      
      // Create PDF viewer structure
      const viewer = this.createViewerStructure(container, pdfDoc.numPages, options);
      
      // Render first page
      await this.renderPage(pdfDoc, 1, viewer.canvas, viewer.context);
      
      // Update page info
      viewer.pageInfo.textContent = `1 / ${pdfDoc.numPages}`;

      // Setup navigation
      this.setupNavigation(pdfDoc, viewer);

      // Setup zoom controls
      this.setupZoomControls(pdfDoc, viewer);

      return {
        pdfDoc,
        viewer,
        getCurrentPage: () => viewer.currentPage,
        goToPage: (pageNum) => this.goToPage(pdfDoc, pageNum, viewer),
        zoom: (factor) => this.zoom(pdfDoc, viewer, factor),
        destroy: () => this.destroyPreview(viewer)
      };

    } catch (error) {
      console.error('Error creating PDF preview:', error);
      container.innerHTML = `
        <div class="pdf-error">
          <div class="error-icon">⚠️</div>
          <h3>Cannot preview PDF</h3>
          <p>Error loading PDF file: ${error.message}</p>
          <button class="btn btn-primary" onclick="window.open('${url}', '_blank')">
            Open in new tab
          </button>
        </div>
      `;
      throw error;
    }
  }

  /**
   * Create viewer structure
   * @param {Element} container Container element
   * @param {number} numPages Number of pages
   * @param {Object} options Options
   * @returns {Object} Viewer elements
   */
  createViewerStructure(container, numPages, options) {
    const viewerHTML = `
      <div class="pdf-viewer">
        <div class="pdf-toolbar">
          <div class="pdf-nav">
            <button class="btn btn-secondary pdf-prev" title="Previous page">
              ←
            </button>
            <span class="pdf-page-info">1 / ${numPages}</span>
            <button class="btn btn-secondary pdf-next" title="Next page">
              →
            </button>
          </div>
          <div class="pdf-zoom">
            <button class="btn btn-secondary pdf-zoom-out" title="Zoom out">
              −
            </button>
            <span class="pdf-zoom-level">100%</span>
            <button class="btn btn-secondary pdf-zoom-in" title="Zoom in">
              +
            </button>
            <button class="btn btn-secondary pdf-fit" title="Fit to width">
              Fit
            </button>
          </div>
        </div>
        <div class="pdf-canvas-container">
          <canvas class="pdf-canvas"></canvas>
        </div>
      </div>
    `;

    container.innerHTML = viewerHTML;

    const canvas = container.querySelector('.pdf-canvas');
    const context = canvas.getContext('2d');
    
    return {
      container: container.querySelector('.pdf-viewer'),
      toolbar: container.querySelector('.pdf-toolbar'),
      canvasContainer: container.querySelector('.pdf-canvas-container'),
      canvas,
      context,
      prevBtn: container.querySelector('.pdf-prev'),
      nextBtn: container.querySelector('.pdf-next'),
      pageInfo: container.querySelector('.pdf-page-info'),
      zoomOutBtn: container.querySelector('.pdf-zoom-out'),
      zoomInBtn: container.querySelector('.pdf-zoom-in'),
      zoomLevel: container.querySelector('.pdf-zoom-level'),
      fitBtn: container.querySelector('.pdf-fit'),
      currentPage: 1,
      scale: 1.0,
      numPages
    };
  }

  /**
   * Render PDF page
   * @param {Object} pdfDoc PDF document
   * @param {number} pageNum Page number
   * @param {Element} canvas Canvas element
   * @param {Object} context Canvas context
   * @param {number} scale Scale factor
   * @returns {Promise<void>}
   */
  async renderPage(pdfDoc, pageNum, canvas, context, scale = 1.0) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Set canvas dimensions
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render page
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      console.log('Rendered page:', pageNum);

    } catch (error) {
      console.error('Error rendering page:', pageNum, error);
      throw error;
    }
  }

  /**
   * Setup navigation controls
   * @param {Object} pdfDoc PDF document
   * @param {Object} viewer Viewer elements
   */
  setupNavigation(pdfDoc, viewer) {
    // Previous page
    viewer.prevBtn.addEventListener('click', () => {
      if (viewer.currentPage > 1) {
        this.goToPage(pdfDoc, viewer.currentPage - 1, viewer);
      }
    });

    // Next page
    viewer.nextBtn.addEventListener('click', () => {
      if (viewer.currentPage < viewer.numPages) {
        this.goToPage(pdfDoc, viewer.currentPage + 1, viewer);
      }
    });

    // Update button states
    this.updateNavigationState(viewer);
  }

  /**
   * Setup zoom controls
   * @param {Object} pdfDoc PDF document
   * @param {Object} viewer Viewer elements
   */
  setupZoomControls(pdfDoc, viewer) {
    // Zoom out
    viewer.zoomOutBtn.addEventListener('click', () => {
      this.zoom(pdfDoc, viewer, viewer.scale * 0.8);
    });

    // Zoom in
    viewer.zoomInBtn.addEventListener('click', () => {
      this.zoom(pdfDoc, viewer, viewer.scale * 1.2);
    });

    // Fit to width
    viewer.fitBtn.addEventListener('click', () => {
      this.fitToWidth(pdfDoc, viewer);
    });

    // Mouse wheel zoom
    viewer.canvasContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom(pdfDoc, viewer, viewer.scale * delta);
      }
    });
  }

  /**
   * Go to specific page
   * @param {Object} pdfDoc PDF document
   * @param {number} pageNum Page number
   * @param {Object} viewer Viewer elements
   * @returns {Promise<void>}
   */
  async goToPage(pdfDoc, pageNum, viewer) {
    if (pageNum < 1 || pageNum > viewer.numPages) {
      return;
    }

    viewer.currentPage = pageNum;
    await this.renderPage(pdfDoc, pageNum, viewer.canvas, viewer.context, viewer.scale);
    
    viewer.pageInfo.textContent = `${pageNum} / ${viewer.numPages}`;
    this.updateNavigationState(viewer);
  }

  /**
   * Zoom to specific scale
   * @param {Object} pdfDoc PDF document
   * @param {Object} viewer Viewer elements
   * @param {number} scale Scale factor
   * @returns {Promise<void>}
   */
  async zoom(pdfDoc, viewer, scale) {
    // Limit zoom range
    scale = Math.max(0.5, Math.min(3.0, scale));
    
    viewer.scale = scale;
    await this.renderPage(pdfDoc, viewer.currentPage, viewer.canvas, viewer.context, scale);
    
    viewer.zoomLevel.textContent = `${Math.round(scale * 100)}%`;
  }

  /**
   * Fit PDF to container width
   * @param {Object} pdfDoc PDF document
   * @param {Object} viewer Viewer elements
   * @returns {Promise<void>}
   */
  async fitToWidth(pdfDoc, viewer) {
    try {
      const page = await pdfDoc.getPage(viewer.currentPage);
      const viewport = page.getViewport({ scale: 1.0 });
      
      const containerWidth = viewer.canvasContainer.clientWidth - 40; // Account for padding
      const scale = containerWidth / viewport.width;
      
      await this.zoom(pdfDoc, viewer, scale);
    } catch (error) {
      console.error('Error fitting to width:', error);
    }
  }

  /**
   * Update navigation button states
   * @param {Object} viewer Viewer elements
   */
  updateNavigationState(viewer) {
    viewer.prevBtn.disabled = viewer.currentPage <= 1;
    viewer.nextBtn.disabled = viewer.currentPage >= viewer.numPages;
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
   * Create simple PDF iframe viewer (fallback)
   * @param {string} url PDF URL
   * @param {Element} container Container element
   * @returns {Object} Simple viewer
   */
  createSimpleViewer(url, container) {
    container.innerHTML = `
      <div class="pdf-simple-viewer">
        <div class="pdf-toolbar">
          <button class="btn btn-primary" onclick="window.open('${url}', '_blank')">
            Open in new tab
          </button>
        </div>
        <iframe 
          src="${url}" 
          style="width: 100%; height: 500px; border: none; border-radius: var(--radius-md);"
          title="PDF Preview">
        </iframe>
      </div>
    `;

    return {
      destroy: () => {
        container.innerHTML = '';
      }
    };
  }

  /**
   * Check if PDF.js is supported
   * @returns {boolean} True if supported
   */
  isSupported() {
    return typeof window !== 'undefined' && 'Worker' in window;
  }

  /**
   * Get PDF metadata
   * @param {string} url PDF URL
   * @returns {Promise<Object>} PDF metadata
   */
  async getMetadata(url) {
    try {
      await this.loadLibrary();
      const pdfDoc = await window.pdfjsLib.getDocument(url).promise;
      const metadata = await pdfDoc.getMetadata();
      
      return {
        numPages: pdfDoc.numPages,
        title: metadata.info.Title || '',
        author: metadata.info.Author || '',
        subject: metadata.info.Subject || '',
        creator: metadata.info.Creator || '',
        producer: metadata.info.Producer || '',
        creationDate: metadata.info.CreationDate || null,
        modDate: metadata.info.ModDate || null
      };
    } catch (error) {
      console.error('Error getting PDF metadata:', error);
      return null;
    }
  }
}

// CSS styles for PDF viewer
const pdfStyles = `
.pdf-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pdf-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--surface);
  border-bottom: 1px solid var(--border-primary);
  gap: var(--space-md);
}

.pdf-nav {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.pdf-page-info {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  min-width: 60px;
  text-align: center;
}

.pdf-zoom {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.pdf-zoom-level {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  min-width: 40px;
  text-align: center;
}

.pdf-canvas-container {
  flex: 1;
  overflow: auto;
  padding: var(--space-md);
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.pdf-canvas {
  max-width: 100%;
  box-shadow: var(--shadow-lg);
  border-radius: var(--radius-sm);
}

.pdf-error {
  text-align: center;
  padding: var(--space-3xl);
  color: var(--text-muted);
}

.pdf-error .error-icon {
  font-size: 3rem;
  margin-bottom: var(--space-lg);
}

.pdf-simple-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.pdf-simple-viewer .pdf-toolbar {
  flex-shrink: 0;
}

.pdf-simple-viewer iframe {
  flex: 1;
}

@media (max-width: 768px) {
  .pdf-toolbar {
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-sm);
  }
  
  .pdf-nav,
  .pdf-zoom {
    gap: var(--space-xs);
  }
  
  .pdf-canvas-container {
    padding: var(--space-sm);
  }
}
`;

// Inject PDF styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = pdfStyles;
  document.head.appendChild(styleSheet);
}

// Create and export PDF preview manager instance
const pdfPreviewManager = new PDFPreviewManager();

export default pdfPreviewManager;

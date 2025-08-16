# Drive Nest 🗂️

A modern, feature-rich personal cloud storage web application built with vanilla HTML, CSS, and JavaScript, powered by Firebase backend services.

![Drive Nest Banner](https://via.placeholder.com/800x200/4F46E5/FFFFFF?text=Drive+Nest+-+Personal+Cloud+Storage)

## ✨ Features

### 🔐 **Authentication & Security**
- Google OAuth integration via Firebase Authentication
- Secure user authentication with session management
- User profile and account management

### 📁 **File Management**
- **Upload**: Drag-and-drop or click to upload files
- **Preview**: Built-in preview for images, videos, audio, PDFs, DOCX, and text files
- **Download**: One-click file downloads
- **Delete**: Secure file deletion with confirmation
- **Organization**: Intuitive file grid with metadata display

### 🎨 **User Experience**
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark Mode**: System-aware theme switching (Light/Dark/Auto)
- **Progressive Web App**: Installable with offline capabilities
- **Accessibility**: WCAG 2.1 AA compliant with full keyboard navigation
- **Performance**: Optimized loading and caching strategies

### ⌨️ **Productivity Features**
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Search**: Real-time file search and filtering
- **View Modes**: Grid and list view options
- **Batch Operations**: Multi-file selection and operations
- **Upload Queue**: Background upload with progress tracking

### 🔍 **File Preview System**
- **PDF Documents**: Full PDF viewer with zoom, navigation controls
- **Microsoft Word**: DOCX preview with formatting preservation
- **Images**: Zoomable image viewer with rotation
- **Videos**: Native HTML5 video player
- **Audio**: Built-in audio player
- **Text Files**: Syntax-highlighted code preview
- **Fallback Support**: Graceful degradation for unsupported types

## 🛠️ Technology Stack

### Frontend
- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Modern CSS with custom properties, grid, and flexbox
- **JavaScript (ES6+)**: Vanilla JS with modules, async/await
- **PWA**: Service Worker, Web App Manifest

### Backend Services
- **Firebase Authentication**: Google OAuth and session management
- **Firebase Storage**: Secure file storage with access controls
- **Firebase Firestore**: Real-time database for file metadata
- **Firebase Hosting**: Fast, secure web hosting

### Third-party Libraries
- **PDF.js**: Client-side PDF rendering
- **docx-preview**: DOCX document preview
- **Browser APIs**: File API, Drag and Drop, Intersection Observer

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ (for development tools)
- Firebase project with enabled services
- Modern web browser with ES6 support

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/drive-nest.git
cd drive-nest
```

### 2. Firebase Setup
1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable the following services:
   - **Authentication** with Google provider
   - **Cloud Firestore** database
   - **Cloud Storage** for file uploads
   - **Hosting** (optional for deployment)

3. Get your Firebase configuration:
   - Go to Project Settings → General → Your apps
   - Click "Web app" and copy the configuration

### 3. Configure Firebase
1. Copy the configuration template:
```bash
cp scripts/firebase-config.example.js scripts/firebase-config.js
```

2. Edit `scripts/firebase-config.js` with your Firebase credentials:
```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

### 4. Set Up Firebase Security Rules

#### Firestore Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Files collection - users can only access their own files
    match /files/{fileId} {
      allow read, write, delete: if request.auth != null 
        && request.auth.uid == resource.data.uploadedBy;
      allow create: if request.auth != null 
        && request.auth.uid == request.resource.data.uploadedBy;
    }
    
    // Shared files collection
    match /shared/{shareId} {
      allow read: if request.auth != null;
      allow write, create: if request.auth != null 
        && request.auth.uid == request.resource.data.ownerId;
      allow delete: if request.auth != null 
        && request.auth.uid == resource.data.ownerId;
    }
  }
}
```

#### Storage Rules (`storage.rules`)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // User files - organized by user ID
    match /files/{userId}/{fileName} {
      allow read, write, delete: if request.auth != null 
        && request.auth.uid == userId;
    }
  }
}
```

### 5. Local Development
1. Install development dependencies (optional):
```bash
npm install -g firebase-tools
npm install -g http-server
```

2. Serve the application locally:
```bash
# Using Node.js http-server
http-server -p 3000

# Or using Python
python -m http.server 3000

# Or using Firebase CLI
firebase serve --only hosting
```

3. Open your browser to `http://localhost:3000`

### 6. Deploy to Firebase Hosting

1. Initialize Firebase Hosting:
```bash
firebase init hosting
```

2. Configure `firebase.json`:
```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**",
      "README.md",
      "scripts/firebase-config.example.js"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

3. Deploy:
```bash
firebase deploy
```

## 📖 Usage Guide

### Basic Operations

#### Upload Files
- **Drag & Drop**: Drag files from your computer directly into the file area
- **Click Upload**: Click the "Upload" button and select files
- **Multiple Files**: Select or drag multiple files for batch upload

#### File Preview
- **Click any file** to open the preview modal
- **Navigation**: Use arrow keys to navigate between files
- **Zoom**: Use mouse wheel or controls to zoom images and PDFs
- **Download**: Click download button in preview modal

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + U` | Upload files |
| `Delete` | Delete selected files |
| `Space` | Preview selected file |
| `Escape` | Close modal/deselect |
| `Ctrl/Cmd + A` | Select all files |
| `Arrow Keys` | Navigate files |
| `Enter` | Open file preview |
| `Ctrl/Cmd + F` | Focus search |
| `?` | Show help dialog |

### File Organization
- **Search**: Use the search bar to find files by name
- **Sort**: Click column headers to sort files
- **View**: Switch between grid and list views
- **Select**: Click files to select, Ctrl+click for multiple selection

## 🎨 Customization

### Themes
The application includes three theme modes:
- **Light**: Default light theme
- **Dark**: Dark theme for low-light environments
- **System**: Automatically follows system preference

Themes can be customized by modifying CSS custom properties in `styles/base.css`.

### Adding File Type Support
To add support for new file types:

1. **Create a preview manager** in `scripts/preview/`:
```javascript
class NewFileTypePreviewManager {
  async createPreview(url, container, options) {
    // Implementation
  }
}
```

2. **Register in preview router** (`scripts/preview/index.js`):
```javascript
this.previewManagers.set('newtype', new NewFileTypePreviewManager());
this.supportedTypes.set('newtype', {
  mimeTypes: ['application/newtype'],
  extensions: ['.newext'],
  name: 'New File Type',
  icon: '📄'
});
```

## 🔧 Configuration Options

### Upload Settings
Modify upload constraints in `scripts/upload.js`:
```javascript
this.maxFileSize = 100 * 1024 * 1024; // 100MB
this.maxConcurrentUploads = 3;
this.allowedTypes = new Set([...]);
```

### Performance Settings
Adjust performance parameters in respective modules:
- **File loading batch size**: `app.js`
- **Search debounce delay**: `app.js`
- **Preview cache settings**: `preview/index.js`

## 📱 Progressive Web App

Drive Nest is built as a PWA and includes:
- **Web App Manifest**: `manifest.json` for installation
- **Service Worker**: Offline caching and background sync
- **Responsive Design**: Works on all device sizes
- **Touch Gestures**: Mobile-optimized interactions

### Installation
Users can install Drive Nest as a native app:
1. Open the application in a supported browser
2. Click the install prompt or use browser menu
3. Enjoy native app experience

## 🌐 Browser Support

Drive Nest supports all modern browsers:
- **Chrome/Chromium** 88+
- **Firefox** 85+
- **Safari** 14+
- **Edge** 88+

### Feature Requirements
- ES6+ module support
- CSS Grid and Custom Properties
- File API and Drag & Drop
- Fetch API and Promises

## 🛡️ Security & Privacy

### Data Protection
- **Client-side encryption**: Files are encrypted in transit
- **Access control**: Firebase security rules prevent unauthorized access
- **Authentication**: Google OAuth ensures secure user verification
- **CORS protection**: Proper CORS configuration for API security

### Privacy Policy
- **No tracking**: No third-party tracking or analytics
- **Local storage**: User preferences stored locally
- **Data ownership**: Users own their uploaded data
- **Deletion**: Complete data removal on account deletion

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the existing code style and structure
4. Test your changes thoroughly
5. Commit with descriptive messages
6. Push and create a Pull Request

### Code Standards
- **HTML**: Semantic markup, accessibility attributes
- **CSS**: BEM methodology, mobile-first approach
- **JavaScript**: ES6+, async/await, proper error handling
- **Comments**: JSDoc format for functions and classes

### Testing
- Test across different browsers and devices
- Verify accessibility with screen readers
- Check performance with browser dev tools
- Test file operations with various file types

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Firebase**: Backend services and hosting
- **PDF.js**: PDF rendering capabilities
- **Mozilla**: Web standards and accessibility guidelines
- **Google**: Material Design inspiration
- **Contributors**: All developers who have contributed to this project

## 📞 Support

If you encounter any issues or have questions:

1. **Check the documentation** above
2. **Search existing issues** in the GitHub repository
3. **Create a new issue** with detailed information
4. **Join discussions** in the project discussions tab

### Troubleshooting Common Issues

#### Authentication Problems
- Verify Firebase configuration in `firebase-config.js`
- Check Google OAuth setup in Firebase console
- Ensure domain is authorized in Firebase settings

#### Upload Failures
- Check file size limits and Firebase Storage quotas
- Verify Firebase Storage security rules
- Check browser console for error messages

#### Preview Not Working
- Ensure third-party cookies are enabled
- Check browser compatibility for file types
- Verify CORS settings for file URLs

---

**Built with ❤️ using vanilla web technologies**

*Drive Nest - Your personal cloud storage solution*

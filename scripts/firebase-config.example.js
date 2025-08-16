// Firebase Configuration Example
// Copy this file to firebase-config.js and fill in your actual Firebase project credentials

// TO GET STARTED:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new Firebase project or select an existing one
// 3. Go to Project Settings > General > Your apps
// 4. Click "Add app" and select "Web" (</>) 
// 5. Register your app and copy the config object below
// 6. Enable Authentication with Google provider in Authentication > Sign-in method
// 7. Create Firestore database in Firestore Database > Create database
// 8. Enable Storage in Storage > Get started

export const firebaseConfig = {
  // Replace these with your actual Firebase project credentials
  apiKey: "your-api-key-here",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789012345678",
  measurementId: "G-XXXXXXXXXX" // Optional, for Analytics
};

// Storage configuration
export const storageConfig = {
  // Maximum file size in bytes (100MB default)
  maxFileSize: 100 * 1024 * 1024,
  
  // Allowed file types (empty array means all types allowed)
  allowedFileTypes: [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Videos
    'video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov',
    // Audio
    'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg', 'audio/flac',
    // Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text
    'text/plain', 'text/html', 'text/css', 'text/javascript', 'application/json',
    'text/markdown', 'text/xml', 'application/xml',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/x-tar', 'application/gzip'
  ],
  
  // Storage quota in bytes (15GB default - matching Google Drive free tier)
  storageQuota: 15 * 1024 * 1024 * 1024
};

// App configuration
export const appConfig = {
  // App name
  name: 'Drive Nest',
  
  // Version
  version: '1.0.0',
  
  // Default theme
  defaultTheme: 'system', // 'light', 'dark', or 'system'
  
  // File versioning
  enableVersioning: true,
  maxVersions: 5,
  
  // Sharing
  defaultLinkExpiry: '7d', // '1h', '1d', '7d', '30d', or 'never'
  
  // Upload
  chunkSize: 256 * 1024, // 256KB chunks for resumable uploads
  
  // UI
  filesPerPage: 50,
  thumbnailSize: 200,
  
  // Cache
  cacheExpiration: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

// Development mode flag
export const isDevelopment = window.location.hostname === 'localhost' || 
                             window.location.hostname === '127.0.0.1' ||
                             window.location.hostname === '';

// Enable Firebase Analytics (optional)
export const enableAnalytics = false;

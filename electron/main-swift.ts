import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { SwiftAudioBridge } from './swift-audio-bridge';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow;
let swiftAudioBridge: SwiftAudioBridge;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset',
    title: 'Journal - Swift Audio Edition'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:1420');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  createWindow();
  
  // Initialize Swift audio bridge
  swiftAudioBridge = new SwiftAudioBridge();
  
  try {
    // Try to build Swift package if needed
    await SwiftAudioBridge.buildSwiftPackage();
    await swiftAudioBridge.initialize();
    console.log('✅ Swift audio bridge ready');
  } catch (error) {
    console.error('❌ Failed to initialize Swift audio bridge:', error);
    console.log('💡 Make sure Xcode and Swift are installed on this macOS system');
  }

  // Set up transcription update forwarding
  swiftAudioBridge.on('transcription', (transcription: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription-update', transcription);
    }
  });

  swiftAudioBridge.on('disconnected', () => {
    console.log('Swift audio service disconnected');
  });

  // Set up IPC handlers
  setupIPCHandlers();
});

function setupIPCHandlers(): void {
  // Start recording
  ipcMain.handle('start-recording', async () => {
    try {
      const success = await swiftAudioBridge.startRecording();
      console.log('Recording started:', success);
      return success;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  });

  // Stop recording
  ipcMain.handle('stop-recording', async () => {
    try {
      const success = await swiftAudioBridge.stopRecording();
      console.log('Recording stopped:', success);
      return success;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      return false;
    }
  });

  // Check if recording
  ipcMain.handle('is-recording', async () => {
    try {
      return swiftAudioBridge.isRecording();
    } catch (error) {
      console.error('Failed to check recording status:', error);
      return false;
    }
  });

  // Get audio levels
  ipcMain.handle('get-audio-levels', async () => {
    try {
      return {
        microphone: swiftAudioBridge.getMicrophoneLevel(),
        systemAudio: swiftAudioBridge.getSystemAudioLevel()
      };
    } catch (error) {
      console.error('Failed to get audio levels:', error);
      return { microphone: 0, systemAudio: 0 };
    }
  });

  // Get status
  ipcMain.handle('get-status', async () => {
    try {
      return await swiftAudioBridge.getStatus();
    } catch (error) {
      console.error('Failed to get status:', error);
      return {
        isRecording: false,
        microphoneLevel: 0,
        systemAudioLevel: 0,
        transcriptionEnabled: false,
        bufferSize: 0
      };
    }
  });

  // Clear transcription (placeholder)
  ipcMain.handle('clear-transcription', async () => {
    // Swift service handles transcription internally
    return true;
  });

  // Get transcription (placeholder)
  ipcMain.handle('get-transcription', async () => {
    // Transcriptions are sent via events, not stored
    return '';
  });
}

app.on('window-all-closed', async () => {
  // Shutdown Swift service gracefully
  if (swiftAudioBridge) {
    await swiftAudioBridge.shutdown();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app termination
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  if (swiftAudioBridge) {
    await swiftAudioBridge.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  if (swiftAudioBridge) {
    await swiftAudioBridge.shutdown();
  }
  process.exit(0);
});
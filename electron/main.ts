import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { EnhancedAudioRecorder } from './enhanced-audio-recorder';
import { initMain } from 'electron-audio-loopback';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow;
let audioRecorder: EnhancedAudioRecorder;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Journal',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:1420');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Initialize electron-audio-loopback for system audio capture
  initMain();
  
  createWindow();
  audioRecorder = new EnhancedAudioRecorder();

  // Set up transcription update forwarding
  audioRecorder.on('transcription-update', (transcription: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('transcription-update', transcription);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('start-recording', async () => {
  try {
    await audioRecorder.startRecording();
    return true;
  } catch (error) {
    console.error('Failed to start recording:', error);
    return false;
  }
});

ipcMain.handle('stop-recording', async () => {
  try {
    await audioRecorder.stopRecording();
    return true;
  } catch (error) {
    console.error('Failed to stop recording:', error);
    return false;
  }
});

ipcMain.handle('is-recording', () => {
  return audioRecorder.isRecording();
});

ipcMain.handle('get-transcription', () => {
  return audioRecorder.getTranscription();
});

ipcMain.handle('clear-transcription', () => {
  audioRecorder.clearTranscription();
  return true;
});

// System audio capture handler
ipcMain.handle('get-system-audio-stream', async () => {
  try {
    // The main process has initMain() called, so system audio should be available
    // The actual stream will be obtained in the renderer process
    return { success: true };
  } catch (error) {
    console.error('Failed to get system audio stream:', error);
    return { success: false, error: error.message };
  }
});
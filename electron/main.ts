import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { AudioRecorder } from './audio-recorder';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow;
let audioRecorder: AudioRecorder;

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
  createWindow();
  audioRecorder = new AudioRecorder();

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
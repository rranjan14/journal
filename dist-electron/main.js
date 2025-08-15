"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const enhanced_audio_recorder_1 = require("./enhanced-audio-recorder");
const electron_audio_loopback_1 = require("electron-audio-loopback");
const isDev = process.env.NODE_ENV === 'development';
let mainWindow;
let audioRecorder;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    // Initialize electron-audio-loopback for system audio capture
    (0, electron_audio_loopback_1.initMain)();
    createWindow();
    audioRecorder = new enhanced_audio_recorder_1.EnhancedAudioRecorder();
    // Set up transcription update forwarding
    audioRecorder.on('transcription-update', (transcription) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('transcription-update', transcription);
        }
    });
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// IPC handlers
electron_1.ipcMain.handle('start-recording', async () => {
    try {
        await audioRecorder.startRecording();
        return true;
    }
    catch (error) {
        console.error('Failed to start recording:', error);
        return false;
    }
});
electron_1.ipcMain.handle('stop-recording', async () => {
    try {
        await audioRecorder.stopRecording();
        return true;
    }
    catch (error) {
        console.error('Failed to stop recording:', error);
        return false;
    }
});
electron_1.ipcMain.handle('is-recording', () => {
    return audioRecorder.isRecording();
});
electron_1.ipcMain.handle('get-transcription', () => {
    return audioRecorder.getTranscription();
});
electron_1.ipcMain.handle('clear-transcription', () => {
    audioRecorder.clearTranscription();
    return true;
});
// System audio capture handler
electron_1.ipcMain.handle('get-system-audio-stream', async () => {
    try {
        // The main process has initMain() called, so system audio should be available
        // The actual stream will be obtained in the renderer process
        return { success: true };
    }
    catch (error) {
        console.error('Failed to get system audio stream:', error);
        return { success: false, error: error.message };
    }
});

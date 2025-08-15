"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    startRecording: () => electron_1.ipcRenderer.invoke('start-recording'),
    stopRecording: () => electron_1.ipcRenderer.invoke('stop-recording'),
    isRecording: () => electron_1.ipcRenderer.invoke('is-recording'),
    getTranscription: () => electron_1.ipcRenderer.invoke('get-transcription'),
    onTranscriptionUpdate: (callback) => {
        electron_1.ipcRenderer.on('transcription-update', (_event, transcription) => callback(transcription));
    },
    removeTranscriptionListener: () => {
        electron_1.ipcRenderer.removeAllListeners('transcription-update');
    }
});

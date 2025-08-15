import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  isRecording: () => ipcRenderer.invoke('is-recording'),
  getTranscription: () => ipcRenderer.invoke('get-transcription'),
  clearTranscription: () => ipcRenderer.invoke('clear-transcription'),
  getSystemAudioStream: () => ipcRenderer.invoke('get-system-audio-stream'),
  onTranscriptionUpdate: (callback: (transcription: string) => void) => {
    ipcRenderer.on('transcription-update', (_event, transcription) => callback(transcription));
  },
  removeTranscriptionListener: () => {
    ipcRenderer.removeAllListeners('transcription-update');
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      startRecording: () => Promise<boolean>;
      stopRecording: () => Promise<boolean>;
      isRecording: () => Promise<boolean>;
      getTranscription: () => Promise<string>;
      clearTranscription: () => Promise<boolean>;
      getSystemAudioStream: () => Promise<{ success: boolean; error?: string }>;
      onTranscriptionUpdate: (callback: (transcription: string) => void) => void;
      removeTranscriptionListener: () => void;
    };
  }
}
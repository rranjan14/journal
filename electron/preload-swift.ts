import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  isRecording: () => ipcRenderer.invoke('is-recording'),
  getTranscription: () => ipcRenderer.invoke('get-transcription'),
  clearTranscription: () => ipcRenderer.invoke('clear-transcription'),
  getAudioLevels: () => ipcRenderer.invoke('get-audio-levels'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  onTranscriptionUpdate: (callback: (transcription: string) => void) => {
    ipcRenderer.on('transcription-update', (_, transcription) => callback(transcription));
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
      getAudioLevels: () => Promise<{ microphone: number; systemAudio: number }>;
      getStatus: () => Promise<{
        isRecording: boolean;
        microphoneLevel: number;
        systemAudioLevel: number;
        transcriptionEnabled: boolean;
        bufferSize: number;
      }>;
      onTranscriptionUpdate: (callback: (transcription: string) => void) => void;
      removeTranscriptionListener: () => void;
    };
  }
}
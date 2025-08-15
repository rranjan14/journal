export interface ElectronAPI {
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<boolean>;
  isRecording: () => Promise<boolean>;
  getTranscription: () => Promise<string>;
  onTranscriptionUpdate: (callback: (transcription: string) => void) => void;
  removeTranscriptionListener: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
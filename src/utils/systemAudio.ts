// System audio utilities for electron-audio-loopback integration

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

export interface SystemAudioCapabilities {
  microphoneSupported: boolean;
  systemAudioSupported: boolean;
  platform: string;
}

export const checkSystemAudioCapabilities = async (): Promise<SystemAudioCapabilities> => {
  const platform = navigator.platform.toLowerCase();
  
  // Check if we're in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  
  let systemAudioSupported = false;
  
  if (isElectron) {
    try {
      const result = await window.electronAPI.getSystemAudioStream();
      systemAudioSupported = result.success;
    } catch (error) {
      console.warn('System audio not available:', error);
      systemAudioSupported = false;
    }
  }

  return {
    microphoneSupported: !!navigator.mediaDevices?.getUserMedia,
    systemAudioSupported,
    platform
  };
};

export const getSystemAudioStream = async (): Promise<MediaStream | null> => {
  try {
    // This is a placeholder for the actual electron-audio-loopback integration
    // In a real implementation, this would be handled by the preload script
    // and would use the electron-audio-loopback library
    
    console.log('System audio stream requested - would use electron-audio-loopback here');
    
    // For now, return null to indicate system audio is not available
    return null;
    
  } catch (error) {
    console.error('Failed to get system audio stream:', error);
    return null;
  }
};

export const getMicrophoneStream = async (): Promise<MediaStream | null> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 44100,
        channelCount: 1
      }
    });
    return stream;
  } catch (error) {
    console.error('Failed to get microphone stream:', error);
    return null;
  }
};

export const combineAudioStreams = (
  micStream: MediaStream, 
  systemStream?: MediaStream | null
): MediaStream => {
  const audioContext = new AudioContext({ sampleRate: 44100 });
  
  // Create sources
  const micSource = audioContext.createMediaStreamSource(micStream);
  
  // Create mixer
  const mixer = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination();
  
  // Connect microphone
  micSource.connect(mixer);
  
  // Connect system audio if available
  if (systemStream) {
    const systemSource = audioContext.createMediaStreamSource(systemStream);
    systemSource.connect(mixer);
  }
  
  // Connect to destination
  mixer.connect(destination);
  
  return destination.stream;
};
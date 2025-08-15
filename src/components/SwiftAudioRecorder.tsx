import React, { useState, useEffect, useRef } from 'react';

interface SwiftAudioRecorderProps {
  onTranscriptionUpdate: (transcription: string) => void;
}

interface AudioLevels {
  microphone: number;
  systemAudio: number;
}

interface AudioStatus {
  isRecording: boolean;
  microphoneLevel: number;
  systemAudioLevel: number;
  transcriptionEnabled: boolean;
  bufferSize: number;
}

const SwiftAudioRecorder: React.FC<SwiftAudioRecorderProps> = ({ onTranscriptionUpdate }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevels, setAudioLevels] = useState<AudioLevels>({ microphone: 0, systemAudio: 0 });
  const [status, setStatus] = useState<AudioStatus>({
    isRecording: false,
    microphoneLevel: 0,
    systemAudioLevel: 0,
    transcriptionEnabled: false,
    bufferSize: 0
  });
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const levelUpdateInterval = useRef<NodeJS.Timeout>();
  const statusUpdateInterval = useRef<NodeJS.Timeout>();

  // Check if we're in Electron with Swift support
  const isElectronSwift = () => {
    return typeof window !== 'undefined' && 
           window.electronAPI && 
           typeof window.electronAPI.getAudioLevels === 'function';
  };

  useEffect(() => {
    if (!isElectronSwift()) {
      setError('Swift audio support not available. Make sure you\'re running the Swift-enabled version on macOS.');
      return;
    }

    // Set up transcription listener
    window.electronAPI.onTranscriptionUpdate((transcription: string) => {
      onTranscriptionUpdate(transcription);
    });

    // Start periodic updates when recording
    if (isRecording) {
      startPeriodicUpdates();
    } else {
      stopPeriodicUpdates();
    }

    return () => {
      stopPeriodicUpdates();
      if (isElectronSwift()) {
        window.electronAPI.removeTranscriptionListener();
      }
    };
  }, [isRecording, onTranscriptionUpdate]);

  const startPeriodicUpdates = () => {
    // Update audio levels every 100ms
    levelUpdateInterval.current = setInterval(async () => {
      if (isElectronSwift()) {
        try {
          const levels = await window.electronAPI.getAudioLevels();
          setAudioLevels(levels);
        } catch (error) {
          console.error('Failed to get audio levels:', error);
        }
      }
    }, 100);

    // Update status every 500ms
    statusUpdateInterval.current = setInterval(async () => {
      if (isElectronSwift()) {
        try {
          const currentStatus = await window.electronAPI.getStatus();
          setStatus(currentStatus);
        } catch (error) {
          console.error('Failed to get status:', error);
        }
      }
    }, 500);
  };

  const stopPeriodicUpdates = () => {
    if (levelUpdateInterval.current) {
      clearInterval(levelUpdateInterval.current);
      levelUpdateInterval.current = undefined;
    }
    if (statusUpdateInterval.current) {
      clearInterval(statusUpdateInterval.current);
      statusUpdateInterval.current = undefined;
    }
  };

  const startRecording = async () => {
    if (!isElectronSwift()) {
      setError('Swift audio support not available');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const success = await window.electronAPI.startRecording();
      if (success) {
        setIsRecording(true);
        console.log('Swift audio recording started');
      } else {
        setError('Failed to start recording');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      setError(`Failed to start recording: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    if (!isElectronSwift()) {
      setError('Swift audio support not available');
      return;
    }

    setIsLoading(true);

    try {
      const success = await window.electronAPI.stopRecording();
      if (success) {
        setIsRecording(false);
        setAudioLevels({ microphone: 0, systemAudio: 0 });
        console.log('Swift audio recording stopped');
      } else {
        setError('Failed to stop recording');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setError(`Failed to stop recording: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  // Audio level visualization component
  const AudioLevelMeter: React.FC<{ level: number; label: string; color: string }> = ({ level, label, color }) => (
    <div className="flex items-center space-x-2 mb-2">
      <span className="text-sm font-medium w-24">{label}:</span>
      <div className="flex-1 bg-gray-200 rounded-full h-3">
        <div 
          className={`h-3 rounded-full transition-all duration-100 ${color}`}
          style={{ width: `${Math.min(level * 100, 100)}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-12">{Math.round(level * 100)}%</span>
    </div>
  );

  if (!isElectronSwift()) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-bold text-red-800 mb-2">Swift Audio Not Available</h2>
        <p className="text-red-700">
          This component requires the Swift-enabled version of the application running on macOS.
        </p>
        <p className="text-red-600 text-sm mt-2">
          Make sure you have Xcode installed and the Swift audio package is built.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg border-2 border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-blue-800">Swift Audio Recorder</h2>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-sm font-medium text-blue-700">macOS Native</span>
        </div>
      </div>
      
      <p className="text-gray-600 mb-6">
        Native Swift implementation with dual audio capture (microphone + system audio)
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <span className="text-red-500 mr-2">⚠️</span>
            {error}
          </div>
        </div>
      )}

      {/* Status Information */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">System Status</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Recording:</span>
            <span className={`ml-2 ${status.isRecording ? 'text-green-600' : 'text-gray-500'}`}>
              {status.isRecording ? '🎙️ Active' : '⏸️ Inactive'}
            </span>
          </div>
          <div>
            <span className="font-medium">Transcription:</span>
            <span className={`ml-2 ${status.transcriptionEnabled ? 'text-green-600' : 'text-orange-500'}`}>
              {status.transcriptionEnabled ? '✅ Enabled' : '⚠️ Disabled'}
            </span>
          </div>
          <div>
            <span className="font-medium">Buffer Size:</span>
            <span className="ml-2 text-gray-700">{(status.bufferSize / 1024).toFixed(1)} KB</span>
          </div>
          <div>
            <span className="font-medium">Platform:</span>
            <span className="ml-2 text-blue-600">🍎 macOS Swift</span>
          </div>
        </div>
      </div>

      {/* Audio Level Meters */}
      {isRecording && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3 text-blue-800">Real-time Audio Levels</h3>
          <AudioLevelMeter 
            level={audioLevels.microphone} 
            label="Microphone" 
            color="bg-blue-500" 
          />
          <AudioLevelMeter 
            level={audioLevels.systemAudio} 
            label="System Audio" 
            color="bg-green-500" 
          />
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex space-x-4">
        <button
          onClick={toggleRecording}
          disabled={isLoading}
          className={`px-8 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
              : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Processing...</span>
            </div>
          ) : isRecording ? (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span>Stop Recording</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-white rounded-full"></div>
              <span>Start Recording</span>
            </div>
          )}
        </button>

        {!status.transcriptionEnabled && (
          <div className="flex items-center px-4 py-3 bg-orange-100 border border-orange-300 rounded-lg">
            <span className="text-orange-600 text-sm">
              💡 Set OPENAI_API_KEY to enable transcription
            </span>
          </div>
        )}
      </div>

      {/* Recording Status */}
      {isRecording && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-blue-800 font-medium">
              Recording both microphone and system audio...
            </span>
          </div>
          <p className="text-blue-600 text-sm mt-1">
            Transcription will appear below as audio is processed
          </p>
        </div>
      )}
    </div>
  );
};

export default SwiftAudioRecorder;
import React, { useState, useRef } from 'react';

interface DualAudioRecorderProps {
  onTranscriptionUpdate: (transcription: string) => void;
}

const DualAudioRecorder: React.FC<DualAudioRecorderProps> = ({ onTranscriptionUpdate }) => {
  // Use the onTranscriptionUpdate prop when we have transcription results
  const handleTranscriptionUpdate = (text: string) => {
    onTranscriptionUpdate(text);
  };
  const [isRecording, setIsRecording] = useState(false);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [systemAudioStream, setSystemAudioStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [systemAudioLevel, setSystemAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const systemAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  // Audio level monitoring
  const updateAudioLevels = () => {
    if (micAnalyserRef.current) {
      const micDataArray = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
      micAnalyserRef.current.getByteFrequencyData(micDataArray);
      const micAverage = micDataArray.reduce((a, b) => a + b) / micDataArray.length;
      setMicrophoneLevel(micAverage / 255);
    }

    if (systemAnalyserRef.current) {
      const systemDataArray = new Uint8Array(systemAnalyserRef.current.frequencyBinCount);
      systemAnalyserRef.current.getByteFrequencyData(systemDataArray);
      const systemAverage = systemDataArray.reduce((a, b) => a + b) / systemDataArray.length;
      setSystemAudioLevel(systemAverage / 255);
    }

    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
    }
  };

  const startRecording = async () => {
    try {
      setError('');
      setIsRecording(true);

      // Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        }
      });
      setMicrophoneStream(micStream);

      // Get system audio stream using electron-audio-loopback
      let systemStream: MediaStream | null = null;
      try {
        // For now, we'll use a placeholder for system audio
        // In a real implementation, this would use electron-audio-loopback
        console.log('System audio capture would be implemented here');
        // systemStream = await getLoopbackAudioMediaStream({ removeVideo: true });
        // setSystemAudioStream(systemStream);
      } catch (systemError) {
        console.warn('Failed to get system audio stream:', systemError);
        // Continue with microphone only
      }

      // Create audio context for mixing and analysis
      const audioContext = new AudioContext({ sampleRate: 44100 });
      audioContextRef.current = audioContext;

      // Create analysers for level monitoring
      const micAnalyser = audioContext.createAnalyser();
      micAnalyser.fftSize = 256;
      micAnalyserRef.current = micAnalyser;

      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(micAnalyser);

      let systemSource: MediaStreamAudioSourceNode | null = null;
      if (systemStream) {
        const systemAnalyser = audioContext.createAnalyser();
        systemAnalyser.fftSize = 256;
        systemAnalyserRef.current = systemAnalyser;

        systemSource = audioContext.createMediaStreamSource(systemStream);
        systemSource.connect(systemAnalyser);
      }

      // Create a mixer to combine both streams
      const mixer = audioContext.createGain();
      const destination = audioContext.createMediaStreamDestination();
      
      micSource.connect(mixer);
      if (systemSource) {
        systemSource.connect(mixer);
      }
      mixer.connect(destination);

      // Set up MediaRecorder for the combined stream
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          // Process chunk for real-time transcription
          processAudioChunk(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Process final audio
        if (audioChunks.length > 0) {
          const combinedBlob = new Blob(audioChunks, { type: 'audio/webm' });
          processFinalAudio(combinedBlob);
        }
      };

      // Start recording with 2-second chunks for real-time processing
      mediaRecorder.start(2000);

      // Start audio level monitoring
      updateAudioLevels();

      console.log('Dual audio recording started successfully');
      
    } catch (err) {
      console.error('Failed to start dual audio recording:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to start recording: ${errorMessage}`);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop and clean up streams
    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => track.stop());
      setMicrophoneStream(null);
    }

    if (systemAudioStream) {
      systemAudioStream.getTracks().forEach(track => track.stop());
      setSystemAudioStream(null);
    }

    // Clean up audio context
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Reset levels
    setMicrophoneLevel(0);
    setSystemAudioLevel(0);

    console.log('Dual audio recording stopped');
  };

  const processAudioChunk = async (chunk: Blob) => {
    try {
      // Convert blob to buffer and send to backend for transcription
      const arrayBuffer = await chunk.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      
      // For now, we'll use the existing backend transcription
      // In a full implementation, you'd send this to your transcription service
      console.log('Processing audio chunk of size:', buffer.length);
      
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  };

  const processFinalAudio = async (audioBlob: Blob) => {
    try {
      // Process final combined audio
      console.log('Processing final audio blob of size:', audioBlob.size);
      
      // Here you would typically send the final audio to your transcription service
      // For now, we'll trigger the backend transcription
      handleTranscriptionUpdate('Transcription would appear here after processing the combined audio stream');
      
    } catch (error) {
      console.error('Error processing final audio:', error);
    }
  };

  // Audio level visualization component
  const AudioLevelMeter: React.FC<{ level: number; label: string; color: string }> = ({ level, label, color }) => (
    <div className="flex items-center space-x-2 mb-2">
      <span className="text-sm font-medium w-20">{label}:</span>
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-100 ${color}`}
          style={{ width: `${level * 100}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8">{Math.round(level * 100)}%</span>
    </div>
  );

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Dual Audio Recorder</h2>
      <p className="text-gray-600 mb-6">
        Records both microphone input and system audio simultaneously
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Audio Level Meters */}
      {isRecording && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Audio Levels</h3>
          <AudioLevelMeter 
            level={microphoneLevel} 
            label="Microphone" 
            color="bg-blue-500" 
          />
          <AudioLevelMeter 
            level={systemAudioLevel} 
            label="System Audio" 
            color="bg-green-500" 
          />
        </div>
      )}

      {/* Stream Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Stream Status</h3>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${microphoneStream ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm">Microphone</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${systemAudioStream ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-sm">System Audio</span>
          </div>
        </div>
      </div>

      {/* Recording Controls */}
      <div className="flex space-x-4">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={false}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>

      {/* Recording Status */}
      {isRecording && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-blue-800 font-medium">Recording in progress...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DualAudioRecorder;
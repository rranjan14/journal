// src/App.tsx
import { useState, useEffect } from "react";
import WaveformVisualizer from "./components/waveform";

// Type guard to check if we're in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && window.electronAPI;
};

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Set up transcription update listener
  useEffect(() => {
    if (isElectron()) {
      window.electronAPI.onTranscriptionUpdate((newTranscription: string) => {
        setTranscription(newTranscription);
      });

      return () => {
        window.electronAPI.removeTranscriptionListener();
      };
    }
  }, []);

  // Poll recording state to ensure UI reflects backend state
  useEffect(() => {
    if (!isElectron()) return;

    const interval = setInterval(async () => {
      if (isRecording) {
        const recState = await window.electronAPI.isRecording();
        if (!recState && isRecording) {
          setIsRecording(false);
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isRecording]);

  const toggleRecording = async () => {
    if (!isElectron()) {
      console.error("Electron API not available");
      return;
    }

    try {
      if (!isRecording) {
        const success = await window.electronAPI.startRecording();
        if (success) {
          setIsRecording(true);
          setTranscription("");
        } else {
          console.error("Failed to start recording");
        }
      } else {
        setIsLoading(true);
        const success = await window.electronAPI.stopRecording();
        if (success) {
          setIsRecording(false);
        } else {
          console.error("Failed to stop recording");
        }
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error toggling recording:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-center mb-8 text-indigo-700">
          Audio Recorder & Transcriber
        </h1>

        <div className="mb-8">
          <WaveformVisualizer isRecording={isRecording} />
        </div>

        <div className="text-center mb-8">
          <button
            onClick={toggleRecording}
            disabled={isLoading}
            className={`px-6 py-3 rounded-full font-bold text-white transition-all transform hover:scale-105 ${
              isRecording
                ? "bg-red-600 hover:bg-red-700"
                : "bg-indigo-600 hover:bg-indigo-700"
            } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isLoading
              ? "Processing..."
              : isRecording
              ? "Stop Recording"
              : "Start Recording"}
          </button>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            Transcription
          </h2>
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-32">
            {transcription ? (
              <p className="text-gray-800">{transcription}</p>
            ) : (
              <p className="text-gray-400 italic">
                {isRecording
                  ? "Recording in progress..."
                  : "Record audio to generate transcription"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

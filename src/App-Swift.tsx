// src/App-Swift.tsx
import { useState, useEffect } from "react";
import WaveformVisualizer from "./components/waveform";
import SwiftAudioRecorder from "./components/SwiftAudioRecorder";

// Type guard to check if we're in Electron with Swift support
const isElectronSwift = () => {
  return typeof window !== 'undefined' && 
         window.electronAPI && 
         typeof window.electronAPI.getAudioLevels === 'function';
};

function App() {
  const [transcription, setTranscription] = useState("");
  const [allTranscriptions, setAllTranscriptions] = useState<string[]>([]);

  // Set up transcription update listener
  useEffect(() => {
    if (isElectronSwift()) {
      window.electronAPI.onTranscriptionUpdate((newTranscription: string) => {
        setTranscription(newTranscription);
        setAllTranscriptions(prev => [...prev, newTranscription]);
      });

      return () => {
        window.electronAPI.removeTranscriptionListener();
      };
    }
  }, []);

  const clearTranscriptions = () => {
    setTranscription("");
    setAllTranscriptions([]);
  };

  const exportTranscriptions = () => {
    const content = allTranscriptions.join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-transcription-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isElectronSwift()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-red-200">
            <h1 className="text-3xl font-bold text-red-800 mb-4">
              🍎 Swift Audio Edition
            </h1>
            <div className="text-red-600 mb-6">
              <p className="text-lg mb-2">This version requires macOS with Swift support.</p>
              <p className="text-sm">
                Make sure you have:
              </p>
              <ul className="text-left mt-2 space-y-1">
                <li>• Xcode installed</li>
                <li>• Swift audio package built</li>
                <li>• Running on macOS</li>
              </ul>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-700 text-sm">
                If you're on a different platform, use the cross-platform Electron version instead.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              🍎 Journal - Swift Edition
            </h1>
            <p className="text-gray-600">
              Native macOS audio recording with dual capture capabilities
            </p>
          </div>

          <div className="mb-8">
            <WaveformVisualizer isRecording={false} />
          </div>

          {/* Swift Audio Recorder Component */}
          <div className="mb-8">
            <SwiftAudioRecorder onTranscriptionUpdate={setTranscription} />
          </div>

          {/* Transcription Display */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Live Transcription
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={clearTranscriptions}
                  disabled={allTranscriptions.length === 0}
                  className="px-4 py-2 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
                <button
                  onClick={exportTranscriptions}
                  disabled={allTranscriptions.length === 0}
                  className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export
                </button>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-32 max-h-96 overflow-y-auto">
              {transcription ? (
                <div>
                  <div className="text-gray-800 mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                    <div className="flex items-center mb-1">
                      <span className="text-blue-600 font-medium text-sm">Latest:</span>
                      <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 animate-pulse"></div>
                    </div>
                    <p className="text-gray-800">{transcription}</p>
                  </div>
                  
                  {allTranscriptions.length > 1 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-600 mb-2">Previous transcriptions:</h3>
                      <div className="space-y-2">
                        {allTranscriptions.slice(0, -1).reverse().map((text, index) => (
                          <div key={index} className="text-gray-600 text-sm p-2 bg-white border border-gray-200 rounded">
                            {text}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-400 italic">
                  <p className="mb-2">🎙️ Start recording to see live transcription</p>
                  <p className="text-sm">
                    Swift-powered dual audio capture will transcribe both microphone and system audio
                  </p>
                </div>
              )}
            </div>
            
            {allTranscriptions.length > 0 && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Total transcriptions: {allTranscriptions.length}
              </div>
            )}
          </div>

          {/* Feature Highlights */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-blue-500 text-2xl mb-2">🎯</div>
              <h3 className="font-semibold text-gray-800">Native Performance</h3>
              <p className="text-gray-600 text-sm">Direct Swift integration with Core Audio for optimal performance</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-green-500 text-2xl mb-2">🔊</div>
              <h3 className="font-semibold text-gray-800">Dual Audio Capture</h3>
              <p className="text-gray-600 text-sm">Simultaneously record microphone and system audio</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-purple-500 text-2xl mb-2">⚡</div>
              <h3 className="font-semibold text-gray-800">Real-time Processing</h3>
              <p className="text-gray-600 text-sm">Live transcription with OpenAI Whisper integration</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
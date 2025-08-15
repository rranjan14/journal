import Foundation
import SwiftAudioCapture

class AudioCaptureServiceApp: NSObject, DualAudioCaptureDelegate, TranscriptionServiceDelegate {
    private var audioCapture: DualAudioCapture
    private var transcriptionService: TranscriptionService?
    private var isRunning = false
    private var audioBuffer = Data()
    private let bufferSizeThreshold = 1024 * 100 // 100KB threshold for transcription
    
    override init() {
        self.audioCapture = DualAudioCapture()
        super.init()
        
        self.audioCapture.delegate = self
        
        // Initialize transcription service if API key is available
        if let transcriptionService = TranscriptionService() {
            self.transcriptionService = transcriptionService
            transcriptionService.delegate = self
            print("✅ Transcription service initialized")
        } else {
            print("⚠️  OpenAI API key not found. Transcription disabled.")
            print("   Set OPENAI_API_KEY environment variable to enable transcription.")
        }
    }
    
    func run() async {
        print("🎙️  Swift Audio Capture Service")
        print("================================")
        print("Commands:")
        print("  start  - Start dual audio recording")
        print("  stop   - Stop recording")
        print("  status - Show recording status")
        print("  quit   - Exit the service")
        print()
        
        // Request permissions
        do {
            try await audioCapture.requestPermissions()
            print("✅ Audio permissions granted")
        } catch {
            print("❌ Failed to get audio permissions: \(error)")
            return
        }
        
        // Start command loop
        await commandLoop()
    }
    
    private func commandLoop() async {
        isRunning = true
        
        while isRunning {
            print("\n> ", terminator: "")
            
            if let input = readLine()?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
                await handleCommand(input)
            }
        }
    }
    
    private func handleCommand(_ command: String) async {
        switch command {
        case "start":
            await startRecording()
        case "stop":
            stopRecording()
        case "status":
            showStatus()
        case "quit", "exit", "q":
            quit()
        case "help", "h":
            showHelp()
        default:
            print("Unknown command: \(command). Type 'help' for available commands.")
        }
    }
    
    private func startRecording() async {
        guard !audioCapture.isCurrentlyRecording() else {
            print("⚠️  Already recording")
            return
        }
        
        do {
            try audioCapture.startRecording()
            print("🎙️  Started dual audio recording")
            print("   Capturing microphone and system audio...")
            
            if transcriptionService != nil {
                print("   Real-time transcription enabled")
            }
        } catch {
            print("❌ Failed to start recording: \(error)")
        }
    }
    
    private func stopRecording() {
        guard audioCapture.isCurrentlyRecording() else {
            print("⚠️  Not currently recording")
            return
        }
        
        audioCapture.stopRecording()
        print("⏹️  Stopped recording")
        
        // Process any remaining audio buffer
        if !audioBuffer.isEmpty && transcriptionService != nil {
            print("🔄 Processing final audio buffer...")
            transcriptionService?.transcribeAsync(audioData: audioBuffer)
            audioBuffer.removeAll()
        }
    }
    
    private func showStatus() {
        let isRecording = audioCapture.isCurrentlyRecording()
        let micLevel = audioCapture.getMicrophoneLevel()
        let systemLevel = audioCapture.getSystemAudioLevel()
        
        print("📊 Status:")
        print("   Recording: \(isRecording ? "✅ Active" : "❌ Inactive")")
        print("   Microphone Level: \(String(format: "%.2f", micLevel))")
        print("   System Audio Level: \(String(format: "%.2f", systemLevel))")
        print("   Transcription: \(transcriptionService != nil ? "✅ Available" : "❌ Disabled")")
        print("   Buffer Size: \(audioBuffer.count) bytes")
    }
    
    private func showHelp() {
        print("📖 Available Commands:")
        print("   start  - Start dual audio recording (microphone + system audio)")
        print("   stop   - Stop recording and process final transcription")
        print("   status - Show current recording status and audio levels")
        print("   help   - Show this help message")
        print("   quit   - Exit the service")
    }
    
    private func quit() {
        print("👋 Shutting down...")
        
        if audioCapture.isCurrentlyRecording() {
            stopRecording()
        }
        
        isRunning = false
        exit(0)
    }
}

// MARK: - DualAudioCaptureDelegate

extension AudioCaptureServiceApp {
    func audioCapture(_ capture: DualAudioCapture, didReceiveAudioData data: Data, fromSource source: AudioSource) {
        switch source {
        case .microphone:
            // Accumulate microphone data
            break
        case .systemAudio:
            // Accumulate system audio data
            break
        case .combined:
            // Accumulate combined audio for transcription
            audioBuffer.append(data)
            
            // Transcribe when buffer reaches threshold
            if audioBuffer.count >= bufferSizeThreshold {
                transcriptionService?.transcribeAsync(audioData: audioBuffer)
                audioBuffer.removeAll()
            }
        }
    }
    
    func audioCapture(_ capture: DualAudioCapture, didUpdateLevel level: Float, forSource source: AudioSource) {
        // Audio levels are updated - could be used for real-time visualization
        // For now, we'll just store them for status display
    }
    
    func audioCapture(_ capture: DualAudioCapture, didEncounterError error: Error) {
        print("❌ Audio capture error: \(error)")
    }
}

// MARK: - TranscriptionServiceDelegate

extension AudioCaptureServiceApp {
    func transcriptionService(_ service: TranscriptionService, didReceiveTranscription text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        print("\n📝 Transcription: \"\(text)\"")
        print("> ", terminator: "")
        fflush(stdout)
    }
    
    func transcriptionService(_ service: TranscriptionService, didEncounterError error: Error) {
        print("\n❌ Transcription error: \(error)")
        print("> ", terminator: "")
        fflush(stdout)
    }
}

// MARK: - Main Entry Point

@main
struct AudioCaptureServiceMain {
    static func main() async {
        let app = AudioCaptureServiceApp()
        await app.run()
    }
}
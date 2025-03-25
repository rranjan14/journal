import Foundation
import SwiftRs
import AVFoundation

public protocol AudioRecorderDelegate: AnyObject {
    func audioRecorderDidCaptureChunk(_ chunkURL: URL)
    func audioRecorderDidFailWithError(_ error: Error)
    func audioRecorderDidCaptureData(_ audioData: Data)
}

public class AudioRecorder: NSObject {
    private var audioRecorder: AVAudioRecorder?
    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    private var audioData: Data
    private let settings: [String: Any]
    public weak var delegate: AudioRecorderDelegate?
    private var isRecording: Bool = false
    private var mixerNode: AVAudioMixerNode?
    
    override public init() {
        audioData = Data()
        
        settings = [
            AVFormatIDKey: Int(kAudioFormatLinearPCM),
            AVSampleRateKey: 44100.0,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsFloatKey: true,
            AVLinearPCMIsBigEndianKey: false
        ]
        
        super.init()
    }
    
    private func setupAudioEngine() {
        print("🎙️ Setting up audio engine...")
        audioEngine = AVAudioEngine()
        inputNode = audioEngine?.inputNode
        mixerNode = AVAudioMixerNode()
        
        guard let audioEngine = audioEngine,
              let inputNode = inputNode,
              let mixerNode = mixerNode else {
            print("⚠️ Failed to initialize audio components")
            return
        }

        audioEngine.attach(mixerNode)
        let format = inputNode.outputFormat(forBus: 0)
        audioEngine.connect(inputNode, to: mixerNode, format: format)
        
        // 1 second chunks (44100 samples)
        let CHUNK_SIZE = 44100 * MemoryLayout<Float>.stride
        
        mixerNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] (buffer, time) in
            guard let self = self else {
                print("⚠️ Self is nil in tap block")
                return
            }
            
            if !self.isRecording {
                print("⚠️ Tap called but isRecording is false")
                return
            }
            
            let channelData = buffer.floatChannelData?[0]
            let frames = buffer.frameLength
            
            let data = Data(bytes: channelData!, count: Int(frames) * MemoryLayout<Float>.stride)
            self.audioData.append(data)
            
            if self.audioData.count >= CHUNK_SIZE * 2 {
                print("📊 Sending audio chunk: \(self.audioData.count / MemoryLayout<Float>.stride) samples (\(self.audioData.count / 1024) KB)")
                self.delegate?.audioRecorderDidCaptureData(self.audioData)
                self.audioData = Data()
            }
        }
        
        print("🎙️ Audio engine setup complete")
    }
    
    public func startRecording() -> Bool {
        do {
            print("▶️ Starting recording...")
            
            if audioEngine == nil {
                print("🎙️ Audio engine not initialized, setting up...")
                setupAudioEngine()
            }
            
            isRecording = true
            print("🎙️ isRecording flag set to true")
            
            try audioEngine?.start()
            print("✅ Audio engine started successfully")
            return true
        } catch {
            print("❌ Failed to start recording: \(error)")
            delegate?.audioRecorderDidFailWithError(error)
            return false
        }
    }
    
    public func stopRecording() -> Bool {
        print("⏹️ Stopping recording...")
        
        isRecording = false
        print("🎙️ isRecording flag set to false")
        
        audioEngine?.stop()
        print("🛑 Audio engine stopped")
        
        if let node = inputNode {
            print("🔌 Removing tap from input node...")
            node.removeTap(onBus: 0)
            print("✅ Tap removed successfully")
        }
        
        // Send any remaining audio data to delegate before cleanup
        if !audioData.isEmpty {
            print("📝 Processing remaining audio data (\(audioData.count) bytes)...")
            delegate?.audioRecorderDidCaptureData(audioData)
        }
        
        // Clean up resources
        audioData = Data()
        inputNode = nil
        audioEngine = nil
        print("🧹 Audio engine and resources cleaned up")
        
        return true
    }
}

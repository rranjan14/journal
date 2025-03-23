import Foundation
import SwiftRs
import AVFoundation

public protocol AudioRecorderDelegate: AnyObject {
    func audioRecorderDidCaptureChunk(_ chunkURL: URL)
    func audioRecorderDidFailWithError(_ error: Error)
}

public class AudioRecorder: NSObject {
    private var audioRecorder: AVAudioRecorder?
    private var audioEngine: AVAudioEngine?
    private var inputNode: AVAudioInputNode?
    private var audioData: Data
    private var audioURL: URL
    private let settings: [String: Any]
    private let appDirectory: URL
    private let recordingsDirectory: URL
    public weak var delegate: AudioRecorderDelegate?
    private var isRecording: Bool = false
    private var mixerNode: AVAudioMixerNode?
    
    override public init() {
        audioData = Data()
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        
        appDirectory = appSupport.appendingPathComponent("Journal", isDirectory: true)
        recordingsDirectory = appDirectory.appendingPathComponent("Recordings", isDirectory: true)
        audioURL = recordingsDirectory.appendingPathComponent("recording.m4a")
        
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
            print("📊 Buffer received: \(frames) frames, total data size: \(self.audioData.count) bytes")
            
            if self.audioData.count >= 44100 * 2 * MemoryLayout<Float>.stride {
                print("📝 Processing audio chunk...")
                self.processAudioChunk()
            }
        }
        
        print("🎙️ Audio engine setup complete")
    }
    
    private func processAudioChunk() {
        let timestamp = Int(Date().timeIntervalSince1970 * 1000)
        let tempURL = recordingsDirectory.appendingPathComponent("temp_chunk_\(timestamp).wav")
        print("💾 Saving audio chunk to: \(tempURL.path)")
        
        do {
            let audioFile = try AVAudioFile(
                forWriting: tempURL,
                settings: settings,
                commonFormat: .pcmFormatFloat32,
                interleaved: false
            )
            
            let buffer = AVAudioPCMBuffer(
                pcmFormat: inputNode!.outputFormat(forBus: 0),
                frameCapacity: UInt32(audioData.count) / 4
            )!
            
            audioData.withUnsafeBytes { ptr in
                buffer.floatChannelData!.pointee.update(
                    from: ptr.bindMemory(to: Float.self).baseAddress!,
                    count: audioData.count / 4
                )
            }
            buffer.frameLength = buffer.frameCapacity
            
            try audioFile.write(from: buffer)
            print("✅ Successfully wrote audio chunk")
            
            Thread.sleep(forTimeInterval: 0.1)
            delegate?.audioRecorderDidCaptureChunk(tempURL)
            
            audioData = Data()
        } catch {
            print("❌ Failed to save audio chunk: \(error)")
        }
    }
    
    private func ensureDirectoriesExist() -> Bool {
        do {
            print("📂 Creating directories if needed...")
            print("📂 App Directory: \(appDirectory.path)")
            print("📂 Recordings Directory: \(recordingsDirectory.path)")
            
            try FileManager.default.createDirectory(
                at: recordingsDirectory,
                withIntermediateDirectories: true
            )
            return true
        } catch {
            print("❌ Failed to create directories: \(error)")
            return false
        }
    }
    
    private func createUniqueAudioURL() {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd-HHmmss"
        let timestamp = dateFormatter.string(from: Date())
        audioURL = recordingsDirectory.appendingPathComponent("recording-\(timestamp).m4a")
        print("🎤 New recording will be saved to: \(audioURL.path)")
    }
    
    public func startRecording() -> Bool {
        do {
            print("▶️ Starting recording...")
            guard ensureDirectoriesExist() else {
                print("❌ Failed to create necessary directories")
                return false
            }
            
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
        
        if !audioData.isEmpty {
            print("📝 Processing remaining audio data (\(audioData.count) bytes)...")
            processAudioChunk()
        }
        
        audioData = Data()
        inputNode = nil
        audioEngine = nil
        print("🧹 Audio engine and resources cleaned up")
        
        return true
    }
    
    public func getAudioURL() -> URL {
        return audioURL
    }
}

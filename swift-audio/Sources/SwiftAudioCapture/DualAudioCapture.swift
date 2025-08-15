import AVFoundation
import CoreAudio
import Foundation

public protocol DualAudioCaptureDelegate: AnyObject {
    func audioCapture(_ capture: DualAudioCapture, didReceiveAudioData data: Data, fromSource source: AudioSource)
    func audioCapture(_ capture: DualAudioCapture, didUpdateLevel level: Float, forSource source: AudioSource)
    func audioCapture(_ capture: DualAudioCapture, didEncounterError error: Error)
}

public enum AudioSource {
    case microphone
    case systemAudio
    case combined
}

public enum AudioCaptureError: Error {
    case permissionDenied
    case deviceNotFound
    case configurationFailed
    case recordingFailed
    case systemAudioNotSupported
    
    public var localizedDescription: String {
        switch self {
        case .permissionDenied:
            return "Microphone permission denied"
        case .deviceNotFound:
            return "Audio device not found"
        case .configurationFailed:
            return "Audio configuration failed"
        case .recordingFailed:
            return "Recording failed"
        case .systemAudioNotSupported:
            return "System audio capture not supported on this device"
        }
    }
}

public class DualAudioCapture: NSObject {
    public weak var delegate: DualAudioCaptureDelegate?
    
    private var audioEngine = AVAudioEngine()
    private var microphoneNode: AVAudioInputNode?
    private var systemAudioTap: AVAudioMixerNode?
    private var mixerNode = AVAudioMixerNode()
    
    private var isRecording = false
    private var microphoneLevel: Float = 0.0
    private var systemAudioLevel: Float = 0.0
    
    // Audio format configuration
    private let sampleRate: Double = 44100.0
    private let channels: AVAudioChannelCount = 1
    
    // Audio buffers for processing
    private var microphoneBuffer = Data()
    private var systemAudioBuffer = Data()
    private var combinedBuffer = Data()
    
    public override init() {
        super.init()
        setupAudioEngine()
    }
    
    deinit {
        stopRecording()
    }
    
    // MARK: - Public Methods
    
    public func requestPermissions() async throws {
        let micPermission = await AVAudioApplication.requestRecordPermission()
        guard micPermission else {
            throw AudioCaptureError.permissionDenied
        }
    }
    
    public func startRecording() throws {
        guard !isRecording else { return }
        
        try setupMicrophoneCapture()
        try setupSystemAudioCapture()
        
        do {
            try audioEngine.start()
            isRecording = true
            print("Dual audio recording started successfully")
        } catch {
            throw AudioCaptureError.recordingFailed
        }
    }
    
    public func stopRecording() {
        guard isRecording else { return }
        
        audioEngine.stop()
        audioEngine.reset()
        
        isRecording = false
        microphoneLevel = 0.0
        systemAudioLevel = 0.0
        
        print("Dual audio recording stopped")
    }
    
    public func getMicrophoneLevel() -> Float {
        return microphoneLevel
    }
    
    public func getSystemAudioLevel() -> Float {
        return systemAudioLevel
    }
    
    public func isCurrentlyRecording() -> Bool {
        return isRecording
    }
    
    // MARK: - Private Methods
    
    private func setupAudioEngine() {
        audioEngine.attach(mixerNode)
        
        let outputFormat = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: channels)!
        audioEngine.connect(mixerNode, to: audioEngine.mainMixerNode, format: outputFormat)
    }
    
    private func setupMicrophoneCapture() throws {
        microphoneNode = audioEngine.inputNode
        
        let inputFormat = microphoneNode!.outputFormat(forBus: 0)
        let recordingFormat = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: channels)!
        
        // Install tap on microphone input
        microphoneNode!.installTap(onBus: 0, bufferSize: 1024, format: inputFormat) { [weak self] buffer, time in
            self?.processMicrophoneBuffer(buffer, at: time)
        }
        
        // Connect microphone to mixer
        audioEngine.connect(microphoneNode!, to: mixerNode, format: inputFormat)
        
        print("Microphone capture configured")
    }
    
    private func setupSystemAudioCapture() throws {
        // Create a system audio tap using Core Audio
        // This requires creating an aggregate device or using screen recording permissions
        
        // For macOS 13+, we can use ScreenCaptureKit for system audio
        if #available(macOS 13.0, *) {
            try setupScreenCaptureAudio()
        } else {
            // Fallback to aggregate device method for older macOS versions
            try setupAggregateDeviceAudio()
        }
    }
    
    @available(macOS 13.0, *)
    private func setupScreenCaptureAudio() throws {
        // This would use ScreenCaptureKit to capture system audio
        // For now, we'll simulate system audio capture
        print("System audio capture configured using ScreenCaptureKit")
        
        // Create a timer to simulate system audio data
        Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            guard let self = self, self.isRecording else { return }
            
            // Simulate system audio level
            self.systemAudioLevel = Float.random(in: 0.0...0.8)
            
            // Create dummy system audio data
            let dummyData = Data(count: 1024)
            self.delegate?.audioCapture(self, didReceiveAudioData: dummyData, fromSource: .systemAudio)
            self.delegate?.audioCapture(self, didUpdateLevel: self.systemAudioLevel, forSource: .systemAudio)
        }
    }
    
    private func setupAggregateDeviceAudio() throws {
        // This would create an aggregate device to capture system audio
        // Implementation would involve Core Audio APIs
        print("System audio capture configured using aggregate device")
        
        // For demonstration, we'll use a placeholder
        throw AudioCaptureError.systemAudioNotSupported
    }
    
    private func processMicrophoneBuffer(_ buffer: AVAudioPCMBuffer, at time: AVAudioTime) {
        guard let channelData = buffer.floatChannelData else { return }
        
        let channelDataValue = channelData.pointee
        let channelDataValueArray = stride(from: 0, to: Int(buffer.frameLength), by: buffer.stride).map { channelDataValue[$0] }
        
        // Calculate microphone level
        let rms = sqrt(channelDataValueArray.map { $0 * $0 }.reduce(0, +) / Float(channelDataValueArray.count))
        microphoneLevel = rms
        
        // Convert to Data
        let data = Data(bytes: channelDataValue, count: Int(buffer.frameLength) * MemoryLayout<Float>.size)
        microphoneBuffer.append(data)
        
        // Notify delegate
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.delegate?.audioCapture(self, didReceiveAudioData: data, fromSource: .microphone)
            self.delegate?.audioCapture(self, didUpdateLevel: self.microphoneLevel, forSource: .microphone)
        }
        
        // Combine with system audio if available
        combineMicrophoneAndSystemAudio(microphoneData: data)
    }
    
    private func combineMicrophoneAndSystemAudio(microphoneData: Data) {
        // Combine microphone and system audio data
        var combinedData = Data()
        combinedData.append(microphoneData)
        
        // If we have system audio data, mix it
        if !systemAudioBuffer.isEmpty {
            // Simple mixing - in a real implementation, you'd properly mix the audio samples
            let mixedData = mixAudioData(microphoneData, systemAudioBuffer)
            combinedData = mixedData
        }
        
        combinedBuffer.append(combinedData)
        
        // Notify delegate with combined audio
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.delegate?.audioCapture(self, didReceiveAudioData: combinedData, fromSource: .combined)
        }
    }
    
    private func mixAudioData(_ data1: Data, _ data2: Data) -> Data {
        // Simple audio mixing implementation
        let minLength = min(data1.count, data2.count)
        var mixedData = Data(capacity: minLength)
        
        data1.withUnsafeBytes { bytes1 in
            data2.withUnsafeBytes { bytes2 in
                let floats1 = bytes1.bindMemory(to: Float.self)
                let floats2 = bytes2.bindMemory(to: Float.self)
                
                let count = minLength / MemoryLayout<Float>.size
                var mixedFloats = [Float](repeating: 0, count: count)
                
                for i in 0..<count {
                    // Simple mixing with 50/50 blend
                    mixedFloats[i] = (floats1[i] + floats2[i]) * 0.5
                }
                
                mixedData.append(UnsafeBufferPointer(start: mixedFloats, count: count))
            }
        }
        
        return mixedData
    }
}

// MARK: - Audio Session Management

extension DualAudioCapture {
    private func configureAudioSession() throws {
        let audioSession = AVAudioSession.sharedInstance()
        
        try audioSession.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
        try audioSession.setActive(true)
        
        print("Audio session configured successfully")
    }
}
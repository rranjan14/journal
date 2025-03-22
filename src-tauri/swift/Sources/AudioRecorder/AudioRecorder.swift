import Foundation
import AVFoundation

public protocol AudioRecorderDelegate: AnyObject {
    func audioRecorderDidFinishRecording(_ audioURL: URL)
    func audioRecorderDidFailWithError(_ error: Error)
}

public class AudioRecorder: NSObject {
    private var audioRecorder: AVAudioRecorder?
    private var audioURL: URL
    private let settings: [String: Any]
    private let appDirectory: URL
    private let recordingsDirectory: URL
    public weak var delegate: AudioRecorderDelegate?
    
    override public init() {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        
        appDirectory = appSupport.appendingPathComponent("Journal", isDirectory: true)
        recordingsDirectory = appDirectory.appendingPathComponent("Recordings", isDirectory: true)
        audioURL = recordingsDirectory.appendingPathComponent("recording.m4a")
        
        settings = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]
        
        super.init()
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
            guard ensureDirectoriesExist() else {
                print("❌ Failed to create necessary directories")
                return false
            }
            
            createUniqueAudioURL()
            print("▶️ Starting recording to: \(audioURL.path)")
            
            audioRecorder = try AVAudioRecorder(url: audioURL, settings: settings)
            audioRecorder?.delegate = self
            audioRecorder?.prepareToRecord()
            let recordingStarted = audioRecorder?.record() ?? false
            print("🎙️ Recording started: \(recordingStarted)")
            return recordingStarted
        } catch {
            print("❌ Failed to start recording: \(error)")
            delegate?.audioRecorderDidFailWithError(error)
            return false
        }
    }
    
    public func stopRecording() -> String? {
        print("⏹️ Stopping recording...")
        audioRecorder?.stop()
        
        let fileExists = FileManager.default.fileExists(atPath: audioURL.path)
        print("📝 File exists at \(audioURL.path): \(fileExists)")
        
        return fileExists ? audioURL.path : nil
    }
    
    public func getAudioURL() -> URL {
        return audioURL
    }
}

extension AudioRecorder: AVAudioRecorderDelegate {
    public func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if flag {
            delegate?.audioRecorderDidFinishRecording(audioURL)
        } else {
            let error = NSError(domain: "AudioRecorderErrorDomain", code: -1, userInfo: [NSLocalizedDescriptionKey: "Recording finished unsuccessfully"])
            delegate?.audioRecorderDidFailWithError(error)
        }
    }
    
    public func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        if let error = error {
            delegate?.audioRecorderDidFailWithError(error)
        }
    }
}